import type { ChatOptions, AIResponse, AIChunk } from "../types/chat.js";

/**
 * Lifecycle hooks for SDK middleware
 */
export interface VisionMiddleware {
  name?: string;
  onRequest?: (options: ChatOptions, provider: string) => Promise<ChatOptions | void> | ChatOptions | void;
  onResponse?: (response: AIResponse) => Promise<AIResponse | void> | AIResponse | void;
  onError?: (error: unknown, options: ChatOptions, provider: string) => Promise<void> | void;
  onStreamChunk?: (chunk: AIChunk) => Promise<void> | void;
}

/**
 * Middleware execution chain
 */
export class MiddlewareChain {
  private middlewares: VisionMiddleware[] = [];

  public use(middleware: VisionMiddleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public async runOnRequest(options: ChatOptions, provider: string): Promise<ChatOptions> {
    let current = { ...options };
    for (const mw of this.middlewares) {
      if (mw.onRequest) {
        const modified = await mw.onRequest(current, provider);
        if (modified) current = modified;
      }
    }
    return current;
  }

  public async runOnResponse(response: AIResponse): Promise<AIResponse> {
    let current = response;
    for (const mw of this.middlewares) {
      if (mw.onResponse) {
        const modified = await mw.onResponse(current);
        if (modified) current = modified;
      }
    }
    return current;
  }

  public async runOnError(error: unknown, options: ChatOptions, provider: string): Promise<void> {
    for (const mw of this.middlewares) {
      if (mw.onError) {
        try {
          await mw.onError(error, options, provider);
        } catch {
          // ignore middleware error reporting failures
        }
      }
    }
  }

  public async runOnStreamChunk(chunk: AIChunk): Promise<void> {
    for (const mw of this.middlewares) {
      if (mw.onStreamChunk) {
        try {
          await mw.onStreamChunk(chunk);
        } catch {
          // ignore
        }
      }
    }
  }
}
