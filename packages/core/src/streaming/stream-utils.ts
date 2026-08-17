import type { AIChunk, AIResponse, UsageInfo, FinishReason } from "../types/chat.js";

/**
 * Universal Stream Wrapper providing convenient async iteration, caching, and conversion methods
 */
export class AIStream implements AsyncIterable<AIChunk> {
  private source: AsyncIterable<AIChunk> | (() => AsyncIterator<AIChunk>);
  private provider: string;
  private model: string;
  private cachedText = "";
  private cachedChunks: AIChunk[] = [];
  private isConsumed = false;
  private finalResponseCache?: AIResponse;

  constructor(
    source: AsyncIterable<AIChunk> | (() => AsyncIterator<AIChunk>),
    meta: { provider: string; model: string }
  ) {
    this.source = source;
    this.provider = meta.provider;
    this.model = meta.model;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<AIChunk> {
    if (this.isConsumed && this.cachedChunks.length > 0) {
      for (const chunk of this.cachedChunks) {
        yield chunk;
      }
      return;
    }

    const iterator = typeof this.source === "function"
      ? this.source()
      : this.source[Symbol.asyncIterator]();

    let fullText = "";
    let reasoningContent = "";
    let finishReason: FinishReason = "stop";
    let usage: UsageInfo | undefined;
    let lastRaw: unknown;

    try {
      while (true) {
        const { done, value } = await iterator.next();
        if (done) break;

        this.cachedChunks.push(value);

        if (value.delta) {
          fullText += value.delta;
        } else if (value.text && value.text.length > fullText.length) {
          fullText = value.text;
        }
        if (value.reasoningDelta) {
          reasoningContent += value.reasoningDelta;
        }
        if (value.finishReason) {
          finishReason = value.finishReason;
        }
        if (value.usage) {
          usage = value.usage;
        }
        lastRaw = value.rawChunk;

        yield value;
      }
    } finally {
      this.isConsumed = true;
      this.cachedText = fullText;
      this.finalResponseCache = {
        text: fullText,
        reasoningContent: reasoningContent || undefined,
        finishReason,
        usage,
        provider: this.provider,
        model: this.model,
        rawResponse: lastRaw
      };
    }
  }

  /**
   * Converts chunk stream to a stream of incremental text deltas
   */
  async *toTextStream(): AsyncGenerator<string, void, unknown> {
    for await (const chunk of this) {
      if (chunk.delta) {
        yield chunk.delta;
      }
    }
  }

  /**
   * Reads the entire stream until completion and returns the final full text
   */
  async getText(): Promise<string> {
    if (this.isConsumed && this.cachedText) {
      return this.cachedText;
    }
    let text = "";
    for await (const chunk of this) {
      if (chunk.delta) {
        text += chunk.delta;
      } else if (chunk.text && chunk.text.length > text.length) {
        text = chunk.text;
      }
    }
    return text || this.cachedText;
  }

  /**
   * Reads stream to completion and aggregates all metadata into an AIResponse
   */
  async getFinalResponse(): Promise<AIResponse> {
    if (this.isConsumed && this.finalResponseCache) {
      return this.finalResponseCache;
    }
    // Consume if not already consumed
    for await (const _ of this) {
      // iterate to end
    }
    return (
      this.finalResponseCache || {
        text: this.cachedText,
        finishReason: "stop",
        provider: this.provider,
        model: this.model
      }
    );
  }

  /**
   * Converts to a Web standard ReadableStream of AIChunk objects
   */
  toReadableStream(): ReadableStream<AIChunk> {
    const iterator = this[Symbol.asyncIterator]();
    return new ReadableStream<AIChunk>({
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        }
      },
      async cancel() {
        if (iterator.return) {
          await iterator.return();
        }
      }
    });
  }

  /**
   * Converts to a Web standard ReadableStream of UTF-8 encoded text chunks
   */
  toTextReadableStream(): ReadableStream<Uint8Array> {
    const textStream = this.toTextStream();
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const { value, done } = await textStream.next();
          if (done) {
            controller.close();
          } else {
            controller.enqueue(encoder.encode(value));
          }
        } catch (err) {
          controller.error(err);
        }
      },
      async cancel() {
        if (textStream.return) {
          await textStream.return();
        }
      }
    });
  }
}

/**
 * Creates an AIStream from any AsyncIterable<AIChunk>
 */
export function createAIStream(
  source: AsyncIterable<AIChunk> | (() => AsyncIterator<AIChunk>),
  meta: { provider: string; model: string }
): AIStream {
  return new AIStream(source, meta);
}

/**
 * Robust SSE (Server-Sent Events) line parser for Web standard ReadableStream
 */
export async function* parseSSEStream(
  body: ReadableStream<Uint8Array> | null
): AsyncGenerator<{ event?: string; data: string }, void, unknown> {
  if (!body) return;

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      let currentEvent: string | undefined;
      let currentData: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          if (currentData.length > 0) {
            yield { event: currentEvent, data: currentData.join("\n") };
            currentEvent = undefined;
            currentData = [];
          }
          continue;
        }

        if (trimmed.startsWith("event:")) {
          currentEvent = trimmed.slice(6).trim();
        } else if (trimmed.startsWith("data:")) {
          currentData.push(trimmed.slice(5).trim());
        }
      }

      if (currentData.length > 0) {
        yield { event: currentEvent, data: currentData.join("\n") };
      }
    }

    if (buffer.trim()) {
      if (buffer.startsWith("data:")) {
        yield { data: buffer.slice(5).trim() };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
