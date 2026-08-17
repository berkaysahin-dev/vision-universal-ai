import type {
  AIProvider,
  ProviderCapabilities,
  ChatOptions,
  AIResponse,
  AIChunk,
  EmbeddingOptions,
  EmbeddingResponse
} from "@vision-ai/core";

export interface MockBehavior {
  throwError?: Error;
  responseDelayMs?: number;
  responseText?: string;
  toolCallsToReturn?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  chunksToStream?: string[];
  embeddingsToReturn?: number[][];
}

export class MockProvider implements AIProvider {
  public readonly name: string;
  public readonly displayName: string;
  public readonly defaultModel: string;
  public readonly capabilities: ProviderCapabilities;
  public behavior: MockBehavior;
  public callCount = 0;
  public recordedOptions: ChatOptions[] = [];

  constructor(name = "mock-primary", behavior: MockBehavior = {}) {
    this.name = name;
    this.displayName = `Mock ${name}`;
    this.defaultModel = "mock-model-v1";
    this.behavior = behavior;
    this.capabilities = {
      chat: true,
      stream: true,
      tools: true,
      vision: true,
      audioInput: true,
      pdfInput: true,
      jsonSchema: true,
      embeddings: true,
      imageGeneration: true,
      speechToText: true,
      textToSpeech: true
    };
  }

  async chat(options: ChatOptions): Promise<AIResponse> {
    this.callCount++;
    this.recordedOptions.push(options);

    if (this.behavior.responseDelayMs) {
      await new Promise((r) => setTimeout(r, this.behavior.responseDelayMs));
    }

    if (this.behavior.throwError) {
      throw this.behavior.throwError;
    }

    const text = this.behavior.responseText ?? "Mock response from " + this.name;
    const toolCalls = this.behavior.toolCallsToReturn;

    return {
      text,
      toolCalls,
      finishReason: toolCalls && toolCalls.length > 0 ? "tool_calls" : "stop",
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      },
      provider: this.name,
      model: options.model || this.defaultModel
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<AIChunk> {
    this.callCount++;
    this.recordedOptions.push(options);

    if (this.behavior.throwError) {
      throw this.behavior.throwError;
    }

    const chunks = this.behavior.chunksToStream || ["Mock", " ", "stream", " ", "chunk"];
    let accumulated = "";

    for (const chunk of chunks) {
      if (this.behavior.responseDelayMs) {
        await new Promise((r) => setTimeout(r, this.behavior.responseDelayMs));
      }
      accumulated += chunk;
      yield {
        text: accumulated,
        delta: chunk,
        finishReason: chunk === chunks[chunks.length - 1] ? "stop" : undefined
      };
    }
  }

  async embed(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    if (this.behavior.throwError) {
      throw this.behavior.throwError;
    }
    const inputs = Array.isArray(options.input) ? options.input : [options.input];
    return {
      embeddings: this.behavior.embeddingsToReturn || inputs.map(() => [0.1, 0.2, 0.3, 0.4]),
      provider: this.name,
      model: options.model || this.defaultModel
    };
  }
}
