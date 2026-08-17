import type { AIProvider } from "../types/provider.js";
import type { ChatOptions, AIResponse, AIChunk } from "../types/chat.js";
import type { RoutingConfig } from "../types/routing.js";
import { VisionAIError, RateLimitError, TimeoutError, ProviderUnavailableError } from "../errors/index.js";

/**
 * Manages provider selection, failover chains, and resilience routing
 */
export class ModelRouter {
  private config: RoutingConfig;
  private providerGetter: (name: string) => AIProvider | undefined;

  constructor(
    config: RoutingConfig,
    providerGetter: (name: string) => AIProvider | undefined
  ) {
    this.config = {
      strategy: "fallback",
      fallbackOnRateLimit: true,
      fallbackOnServerError: true,
      fallbackOnTimeout: true,
      ...config
    };
    this.providerGetter = providerGetter;
  }

  /**
   * Builds ordered list of provider candidates to attempt
   */
  public getCandidateProviders(): string[] {
    const list = [this.config.default];
    if (this.config.fallback) {
      for (const fb of this.config.fallback) {
        if (!list.includes(fb)) {
          list.push(fb);
        }
      }
    }
    return list;
  }

  /**
   * Determines if an error warrants failing over to the next candidate provider
   */
  private shouldFailover(error: unknown): boolean {
    if (error instanceof RateLimitError && this.config.fallbackOnRateLimit) {
      return true;
    }
    if (error instanceof ProviderUnavailableError && this.config.fallbackOnServerError) {
      return true;
    }
    if (error instanceof TimeoutError && this.config.fallbackOnTimeout) {
      return true;
    }
    if (error instanceof VisionAIError && error.retryable) {
      return true;
    }
    return false;
  }

  /**
   * Executes chat across the candidate chain with auto-failover
   */
  public async executeChat(
    options: ChatOptions,
    executeFn: (provider: AIProvider, opts: ChatOptions) => Promise<AIResponse>
  ): Promise<AIResponse> {
    const candidates = this.getCandidateProviders();
    let lastError: unknown;

    for (let i = 0; i < candidates.length; i++) {
      const providerName = candidates[i];
      const provider = this.providerGetter(providerName);

      if (!provider) {
        lastError = new VisionAIError(`Provider '${providerName}' configured in routing is not registered`);
        continue;
      }

      try {
        return await executeFn(provider, options);
      } catch (err) {
        lastError = err;

        const hasNext = i < candidates.length - 1;
        const canFailover = this.shouldFailover(err);

        if (hasNext && canFailover) {
          const nextProvider = candidates[i + 1];
          this.config.onFallback?.({
            failedProvider: providerName,
            error: err instanceof Error ? err : new Error(String(err)),
            nextProvider,
            attempt: i + 1
          });
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  }

  /**
   * Executes streaming chat across the candidate chain with auto-failover on connection
   */
  public async *executeStream(
    options: ChatOptions,
    streamFn: (provider: AIProvider, opts: ChatOptions) => AsyncIterable<AIChunk>
  ): AsyncIterable<AIChunk> {
    const candidates = this.getCandidateProviders();
    let lastError: unknown;

    for (let i = 0; i < candidates.length; i++) {
      const providerName = candidates[i];
      const provider = this.providerGetter(providerName);

      if (!provider) {
        lastError = new VisionAIError(`Provider '${providerName}' configured in routing is not registered`);
        continue;
      }

      try {
        const stream = streamFn(provider, options);
        // Test first chunk to verify stream establishes successfully
        const iterator = stream[Symbol.asyncIterator]();
        const first = await iterator.next();

        if (first.done) {
          return;
        }

        yield first.value;

        while (true) {
          const { done, value } = await iterator.next();
          if (done) break;
          yield value;
        }

        return;
      } catch (err) {
        lastError = err;

        const hasNext = i < candidates.length - 1;
        const canFailover = this.shouldFailover(err);

        if (hasNext && canFailover) {
          const nextProvider = candidates[i + 1];
          this.config.onFallback?.({
            failedProvider: providerName,
            error: err instanceof Error ? err : new Error(String(err)),
            nextProvider,
            attempt: i + 1
          });
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  }
}
