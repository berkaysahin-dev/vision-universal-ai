import type { AIProvider } from "../types/provider.js";
import type { ChatOptions, AIResponse, AIChunk, ChatMessage } from "../types/chat.js";
import type { GenerateStructuredOptions, StructuredResponse } from "../types/schema.js";
import type { EmbeddingOptions, EmbeddingResponse } from "../types/embedding.js";
import type { ImageGenerationOptions, ImageGenerationResponse } from "../types/image.js";
import type { TranscriptionOptions, TranscriptionResponse, SpeechOptions, SpeechResponse } from "../types/audio.js";
import type { RoutingConfig } from "../types/routing.js";
import { ProviderRegistry, defaultRegistry } from "../registry/provider-registry.js";
import { ModelRouter } from "../router/model-router.js";
import { MiddlewareChain, type VisionMiddleware } from "../pipeline/middleware.js";
import { withRetry } from "../pipeline/retry.js";
import { withTimeout } from "../pipeline/timeout.js";
import { AIStream, createAIStream } from "../streaming/stream-utils.js";
import { runToolLoop } from "../tools/tool-executor.js";
import { parseStructuredJSON } from "../structured/json-parser.js";
import {
  VisionAIError,
  CapabilityNotSupportedError,
  normalizeError
} from "../errors/index.js";

/**
 * Configuration options for VisionAI client
 */
export interface VisionAIOptions {
  /**
   * Target provider name (e.g. 'gemini', 'openai', 'anthropic', 'groq', 'deepseek', 'openrouter', 'ollama', 'mistral')
   */
  provider?: string;

  /**
   * API Key for the active provider
   */
  apiKey?: string;

  /**
   * Custom base URL
   */
  baseUrl?: string;

  /**
   * Default model identifier
   */
  defaultModel?: string;

  /**
   * Global timeout in milliseconds (default: 60000)
   */
  timeoutMs?: number;

  /**
   * Global retry count for retryable errors (default: 3)
   */
  maxRetries?: number;

  /**
   * Advanced multi-provider routing & fallback configuration
   */
  routing?: RoutingConfig;

  /**
   * Initial provider instances to register
   */
  providers?: AIProvider[];

  /**
   * Custom fetch implementation
   */
  fetch?: typeof globalThis.fetch;
}

/**
 * Vision Universal AI - Unified Client
 */
export class VisionAI {
  private registry = new ProviderRegistry();
  private middlewares = new MiddlewareChain();
  private defaultProviderName?: string;
  private defaultModel?: string;
  private timeoutMs: number;
  private maxRetries: number;
  private router?: ModelRouter;

  constructor(options: VisionAIOptions = {}) {
    this.defaultProviderName = options.provider?.toLowerCase();
    this.defaultModel = options.defaultModel;
    this.timeoutMs = options.timeoutMs ?? 60000;
    this.maxRetries = options.maxRetries ?? 3;

    // Register initial providers if supplied
    if (options.providers) {
      for (const p of options.providers) {
        this.registry.register(p);
      }
    }

    // Configure router if routing options provided
    if (options.routing) {
      this.router = new ModelRouter(options.routing, (name) => this.getProvider(name));
      if (!this.defaultProviderName) {
        this.defaultProviderName = options.routing.default.toLowerCase();
      }
    }
  }

  /**
   * Registers a middleware hook
   */
  public use(middleware: VisionMiddleware): this {
    this.middlewares.use(middleware);
    return this;
  }

  /**
   * Registers a new or custom AI Provider
   */
  public register(provider: AIProvider): this {
    this.registry.register(provider);
    if (!this.defaultProviderName) {
      this.defaultProviderName = provider.name.toLowerCase();
    }
    return this;
  }

  /**
   * Resolves provider by name from local registry or global default registry
   */
  public getProvider(name?: string): AIProvider {
    const targetName = (name || this.defaultProviderName || "gemini").toLowerCase();
    const provider = this.registry.get(targetName) || defaultRegistry.get(targetName);

    if (!provider) {
      const available = Array.from(
        new Set([...this.registry.getNames(), ...defaultRegistry.getNames()])
      );
      throw new VisionAIError(
        `Provider '${targetName}' is not registered. Available providers: [${available.join(", ")}]`
      );
    }

    return provider;
  }

  /**
   * Normalizes input argument into standard ChatOptions
   */
  private normalizeOptions(promptOrOptions: string | ChatOptions): ChatOptions {
    if (typeof promptOrOptions === "string") {
      return {
        prompt: promptOrOptions,
        messages: [{ role: "user", content: promptOrOptions }],
        model: this.defaultModel,
        timeoutMs: this.timeoutMs,
        retries: this.maxRetries
      };
    }

    const messages: ChatMessage[] = promptOrOptions.messages
      ? [...promptOrOptions.messages]
      : promptOrOptions.prompt
      ? [{ role: "user", content: promptOrOptions.prompt }]
      : [];

    return {
      ...promptOrOptions,
      messages,
      model: promptOrOptions.model ?? this.defaultModel,
      timeoutMs: promptOrOptions.timeoutMs ?? this.timeoutMs,
      retries: promptOrOptions.retries ?? this.maxRetries
    };
  }

  /**
   * Execute chat completion
   */
  public async chat(promptOrOptions: string | ChatOptions): Promise<AIResponse> {
    const rawOptions = this.normalizeOptions(promptOrOptions);

    const executeWithProvider = async (
      provider: AIProvider,
      opts: ChatOptions
    ): Promise<AIResponse> => {
      const transformedOptions = await this.middlewares.runOnRequest(opts, provider.name);

      return await withRetry(
        async () => {
          return await withTimeout(
            async (signal) => {
              try {
                const finalOpts = { ...transformedOptions, abortSignal: signal };
                let response: AIResponse;

                // Handle automatic multi-turn tool execution loop
                if (finalOpts.tools && finalOpts.tools.length > 0) {
                  response = await runToolLoop(provider, finalOpts);
                } else {
                  response = await provider.chat(finalOpts);
                }

                return await this.middlewares.runOnResponse(response);
              } catch (err) {
                const normalized = normalizeError(err, provider.name, transformedOptions.model || provider.defaultModel);
                await this.middlewares.runOnError(normalized, transformedOptions, provider.name);
                throw normalized;
              }
            },
            transformedOptions.timeoutMs,
            transformedOptions.abortSignal,
            provider.name,
            transformedOptions.model || provider.defaultModel
          );
        },
        {
          maxRetries: transformedOptions.retries,
          abortSignal: transformedOptions.abortSignal
        }
      );
    };

    if (this.router) {
      return await this.router.executeChat(rawOptions, executeWithProvider);
    }

    const provider = this.getProvider();
    return await executeWithProvider(provider, rawOptions);
  }

  /**
   * Execute streaming chat completion
   */
  public async stream(promptOrOptions: string | ChatOptions): Promise<AIStream> {
    const rawOptions = this.normalizeOptions(promptOrOptions);

    const executeStreamWithProvider = (
      provider: AIProvider,
      opts: ChatOptions
    ): AsyncIterable<AIChunk> => {
      const self = this;
      return (async function* () {
        const transformedOptions = await self.middlewares.runOnRequest(opts, provider.name);
        try {
          const providerStream = provider.stream(transformedOptions);
          for await (const chunk of providerStream) {
            await self.middlewares.runOnStreamChunk(chunk);
            yield chunk;
          }
        } catch (err) {
          const normalized = normalizeError(err, provider.name, transformedOptions.model || provider.defaultModel);
          await self.middlewares.runOnError(normalized, transformedOptions, provider.name);
          throw normalized;
        }
      })();
    };

    if (this.router) {
      const routingStream = this.router.executeStream(rawOptions, executeStreamWithProvider);
      return createAIStream(routingStream, {
        provider: "router",
        model: rawOptions.model || this.defaultModel || "auto"
      });
    }

    const provider = this.getProvider();
    const stream = executeStreamWithProvider(provider, rawOptions);
    return createAIStream(stream, {
      provider: provider.name,
      model: rawOptions.model || provider.defaultModel
    });
  }

  /**
   * Generate structured, schema-validated JSON data
   */
  public async generate<T = unknown>(
    options: GenerateStructuredOptions<T>
  ): Promise<StructuredResponse<T>> {
    const response = await this.chat(options);
    const schema = options.responseFormat?.schema;

    const data = parseStructuredJSON<T>(
      response.text,
      schema,
      response.provider,
      response.model
    );

    const validatedData = options.validate ? options.validate(data) : data;

    return {
      data: validatedData,
      rawText: response.text,
      usage: response.usage,
      provider: response.provider,
      model: response.model
    };
  }

  /**
   * Generate vector embeddings
   */
  public async embed(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const provider = this.getProvider();
    if (!provider.embed || !provider.capabilities.embeddings) {
      throw new CapabilityNotSupportedError("embed", provider.name);
    }

    return await withRetry(
      async () => {
        return await withTimeout(
          async (signal) => {
            try {
              return await provider.embed!({ ...options, abortSignal: signal });
            } catch (err) {
              throw normalizeError(err, provider.name, options.model || provider.defaultModel);
            }
          },
          options.timeoutMs ?? this.timeoutMs,
          options.abortSignal,
          provider.name,
          options.model || provider.defaultModel
        );
      },
      { maxRetries: options.retries ?? this.maxRetries, abortSignal: options.abortSignal }
    );
  }

  /**
   * Generate images
   */
  public async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    const provider = this.getProvider();
    if (!provider.generateImage || !provider.capabilities.imageGeneration) {
      throw new CapabilityNotSupportedError("generateImage", provider.name);
    }

    return await withRetry(
      async () => {
        return await withTimeout(
          async (signal) => {
            try {
              return await provider.generateImage!({ ...options, abortSignal: signal });
            } catch (err) {
              throw normalizeError(err, provider.name, options.model || provider.defaultModel);
            }
          },
          options.timeoutMs ?? this.timeoutMs,
          options.abortSignal,
          provider.name,
          options.model || provider.defaultModel
        );
      },
      { maxRetries: options.retries ?? this.maxRetries, abortSignal: options.abortSignal }
    );
  }

  /**
   * Transcribe audio to text
   */
  public async transcribe(options: TranscriptionOptions): Promise<TranscriptionResponse> {
    const provider = this.getProvider();
    if (!provider.transcribe || !provider.capabilities.speechToText) {
      throw new CapabilityNotSupportedError("transcribe", provider.name);
    }

    return await withRetry(
      async () => {
        return await withTimeout(
          async (signal) => {
            try {
              return await provider.transcribe!({ ...options, abortSignal: signal });
            } catch (err) {
              throw normalizeError(err, provider.name, options.model || provider.defaultModel);
            }
          },
          options.timeoutMs ?? this.timeoutMs,
          options.abortSignal,
          provider.name,
          options.model || provider.defaultModel
        );
      },
      { maxRetries: options.retries ?? this.maxRetries, abortSignal: options.abortSignal }
    );
  }

  /**
   * Synthesize text to speech
   */
  public async speak(options: SpeechOptions): Promise<SpeechResponse> {
    const provider = this.getProvider();
    if (!provider.speak || !provider.capabilities.textToSpeech) {
      throw new CapabilityNotSupportedError("speak", provider.name);
    }

    return await withRetry(
      async () => {
        return await withTimeout(
          async (signal) => {
            try {
              return await provider.speak!({ ...options, abortSignal: signal });
            } catch (err) {
              throw normalizeError(err, provider.name, options.model || provider.defaultModel);
            }
          },
          options.timeoutMs ?? this.timeoutMs,
          options.abortSignal,
          provider.name,
          options.model || provider.defaultModel
        );
      },
      { maxRetries: options.retries ?? this.maxRetries, abortSignal: options.abortSignal }
    );
  }
}

/**
 * Factory helper to create VisionAI instance
 */
export function createVisionAI(options?: VisionAIOptions): VisionAI {
  return new VisionAI(options);
}
