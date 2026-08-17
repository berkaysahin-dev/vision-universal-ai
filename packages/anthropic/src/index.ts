import {
  type AIProvider,
  type ProviderCapabilities,
  type ProviderConfig,
  type ChatOptions,
  type ChatContentPart,
  type AIResponse,
  type AIChunk,
  type ToolCall,
  type FinishReason,
  type UsageInfo,
  VisionAIError,
  AuthenticationError,
  RateLimitError,
  InvalidRequestError,
  ProviderUnavailableError,
  parseSSEStream
} from "@vision-ai/core";

export interface AnthropicProviderConfig extends ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  anthropicVersion?: string;
}

export class AnthropicProvider implements AIProvider {
  public readonly name: string = "anthropic";
  public readonly displayName: string = "Anthropic Claude";
  public readonly defaultModel: string;
  public readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    tools: true,
    vision: true,
    audioInput: false,
    pdfInput: true,
    jsonSchema: true,
    embeddings: false,
    imageGeneration: false,
    speechToText: false,
    textToSpeech: false
  };

  private apiKey: string;
  private baseUrl: string;
  private anthropicVersion: string;
  private fetchFn: typeof globalThis.fetch;

  constructor(config: AnthropicProviderConfig = {}) {
    this.apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.ANTHROPIC_API_KEY || "" : "");
    this.baseUrl = (config.baseUrl || "https://api.anthropic.com/v1").replace(/\/$/, "");
    this.defaultModel = config.defaultModel || "claude-3-5-sonnet-20241022";
    this.anthropicVersion = config.anthropicVersion || "2023-06-01";
    this.fetchFn = config.fetch || globalThis.fetch.bind(globalThis);
  }

  private mapFinishReason(reason?: string): FinishReason {
    switch (reason) {
      case "end_turn":
      case "stop_sequence":
        return "stop";
      case "max_tokens":
        return "length";
      case "tool_use":
        return "tool_calls";
      default:
        return "other";
    }
  }

  private formatContentParts(
    content: string | ChatContentPart[]
  ): Array<Record<string, unknown>> {
    if (typeof content === "string") {
      return [{ type: "text", text: content }];
    }

    return content.map((part) => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      }
      if (part.type === "image") {
        let base64Data = "";
        const mediaType = part.mimeType || "image/jpeg";

        if (typeof part.image === "string") {
          if (part.image.startsWith("data:")) {
            const match = part.image.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              base64Data = match[2];
            } else {
              base64Data = part.image;
            }
          } else {
            base64Data = part.image;
          }
        } else {
          const uint8 = part.image instanceof Uint8Array ? part.image : new Uint8Array(part.image);
          base64Data =
            typeof Buffer !== "undefined"
              ? Buffer.from(uint8).toString("base64")
              : btoa(String.fromCharCode(...uint8));
        }

        return {
          type: "image",
          source: {
            type: "base64",
            media_type: mediaType,
            data: base64Data
          }
        };
      }
      if (part.type === "file") {
        let base64Data = "";
        if (typeof part.data === "string") {
          base64Data = part.data;
        } else {
          const uint8 = part.data instanceof Uint8Array ? part.data : new Uint8Array(part.data);
          base64Data =
            typeof Buffer !== "undefined"
              ? Buffer.from(uint8).toString("base64")
              : btoa(String.fromCharCode(...uint8));
        }
        return {
          type: "document",
          source: {
            type: "base64",
            media_type: part.mimeType,
            data: base64Data
          }
        };
      }
      return { type: "text", text: "" };
    });
  }

  private buildRequestBody(options: ChatOptions, stream = false): Record<string, unknown> {
    const messages: Array<Record<string, unknown>> = [];
    let system = options.systemInstruction || "";

    if (options.messages) {
      for (const msg of options.messages) {
        if (msg.role === "system") {
          const text = typeof msg.content === "string" ? msg.content : "";
          system = system ? `${system}\n\n${text}` : text;
        } else if (msg.role === "tool") {
          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: msg.toolCallId,
                content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
              }
            ]
          });
        } else if (msg.role === "assistant" && msg.toolCalls) {
          const contentParts: Array<Record<string, unknown>> = [];
          if (typeof msg.content === "string" && msg.content) {
            contentParts.push({ type: "text", text: msg.content });
          }
          for (const tc of msg.toolCalls) {
            contentParts.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments
            });
          }
          messages.push({
            role: "assistant",
            content: contentParts
          });
        } else {
          messages.push({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: this.formatContentParts(msg.content)
          });
        }
      }
    } else if (options.prompt) {
      messages.push({
        role: "user",
        content: options.prompt
      });
    }

    const body: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      max_tokens: options.maxTokens ?? 4096,
      messages
    };

    if (system) body.system = system;
    if (stream) body.stream = true;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.topK !== undefined) body.top_k = options.topK;
    if (options.stopSequences) body.stop_sequences = options.stopSequences;

    // Tools
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters || { type: "object", properties: {} }
      }));
    }

    return body;
  }

  private handleError(statusCode: number, errorData: unknown, model: string): never {
    const errorObj = typeof errorData === "object" && errorData !== null ? (errorData as Record<string, unknown>) : {};
    const nestedError = typeof errorObj.error === "object" && errorObj.error !== null ? (errorObj.error as Record<string, unknown>) : {};
    const message =
      (nestedError.message as string) ||
      (errorObj.message as string) ||
      `Anthropic API Error (HTTP ${statusCode})`;

    if (statusCode === 401 || statusCode === 403) {
      throw new AuthenticationError(message, { provider: this.name, model, rawError: errorData });
    }
    if (statusCode === 429) {
      throw new RateLimitError(message, { provider: this.name, model, rawError: errorData });
    }
    if (statusCode === 400) {
      throw new InvalidRequestError(message, { provider: this.name, model, rawError: errorData });
    }
    if (statusCode >= 500) {
      throw new ProviderUnavailableError(message, { provider: this.name, model, statusCode, rawError: errorData });
    }

    throw new VisionAIError(message, { provider: this.name, model, statusCode, rawError: errorData });
  }

  public async chat(options: ChatOptions): Promise<AIResponse> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/messages`;
    const body = this.buildRequestBody(options, false);

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.anthropicVersion,
        ...options.headers
      },
      body: JSON.stringify(body),
      signal: options.abortSignal
    });

    if (!response.ok) {
      let errJson: unknown;
      try {
        errJson = await response.json();
      } catch {
        errJson = { message: await response.text() };
      }
      this.handleError(response.status, errJson, model);
    }

    const data = (await response.json()) as {
      model?: string;
      stop_reason?: string;
      content?: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
    };

    let text = "";
    const toolCalls: ToolCall[] = [];

    if (Array.isArray(data.content)) {
      for (const block of data.content) {
        if (block.type === "text" && block.text) {
          text += block.text;
        } else if (block.type === "tool_use" && block.name) {
          toolCalls.push({
            id: block.id || `call_${Math.random().toString(36).substring(2, 9)}`,
            name: block.name,
            arguments: block.input || {}
          });
        }
      }
    }

    const usage: UsageInfo | undefined = data.usage
      ? {
          promptTokens: data.usage.input_tokens ?? 0,
          completionTokens: data.usage.output_tokens ?? 0,
          totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)
        }
      : undefined;

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(data.stop_reason),
      usage,
      provider: this.name,
      model: data.model || model,
      rawResponse: data
    };
  }

  public async *stream(options: ChatOptions): AsyncIterable<AIChunk> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/messages`;
    const body = this.buildRequestBody(options, true);

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.anthropicVersion,
        ...options.headers
      },
      body: JSON.stringify(body),
      signal: options.abortSignal
    });

    if (!response.ok) {
      let errJson: unknown;
      try {
        errJson = await response.json();
      } catch {
        errJson = { message: await response.text() };
      }
      this.handleError(response.status, errJson, model);
    }

    let accumulatedText = "";
    let promptTokens = 0;
    let completionTokens = 0;

    for await (const sse of parseSSEStream(response.body)) {
      if (!sse.data) continue;

      let data: {
        type?: string;
        message?: { usage?: { input_tokens?: number } };
        delta?: { type?: string; text?: string; stop_reason?: string };
        usage?: { output_tokens?: number };
      };

      try {
        data = JSON.parse(sse.data);
      } catch {
        continue;
      }

      let delta = "";
      if (data.type === "message_start" && data.message?.usage) {
        promptTokens = data.message.usage.input_tokens ?? 0;
      } else if (data.type === "content_block_delta" && data.delta?.type === "text_delta") {
        delta = data.delta.text || "";
        accumulatedText += delta;
      } else if (data.type === "message_delta") {
        if (data.usage) {
          completionTokens = data.usage.output_tokens ?? 0;
        }
      }

      const finishReason = data.delta?.stop_reason ? this.mapFinishReason(data.delta.stop_reason) : undefined;
      const usage: UsageInfo = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      };

      yield {
        text: accumulatedText,
        delta,
        finishReason,
        usage: usage.totalTokens > 0 ? usage : undefined,
        rawChunk: data
      };
    }
  }
}

export function createAnthropic(config?: AnthropicProviderConfig): AnthropicProvider {
  return new AnthropicProvider(config);
}
