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
  type EmbeddingOptions,
  type EmbeddingResponse,
  type UsageInfo,
  VisionAIError,
  AuthenticationError,
  RateLimitError,
  InvalidRequestError,
  ProviderUnavailableError,
  parseSSEStream
} from "@vision-ai/core";

export interface GeminiProviderConfig extends ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  apiVersion?: string;
}

export class GeminiProvider implements AIProvider {
  public readonly name: string = "gemini";
  public readonly displayName: string = "Google Gemini";
  public readonly defaultModel: string;
  public readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    tools: true,
    vision: true,
    audioInput: true,
    pdfInput: true,
    jsonSchema: true,
    embeddings: true,
    imageGeneration: false,
    speechToText: false,
    textToSpeech: false
  };

  private apiKey: string;
  private baseUrl: string;
  private fetchFn: typeof globalThis.fetch;

  constructor(config: GeminiProviderConfig = {}) {
    this.apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY || "" : "");
    this.baseUrl = (config.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
    this.defaultModel = config.defaultModel || "gemini-2.0-flash";
    this.fetchFn = config.fetch || globalThis.fetch.bind(globalThis);
  }

  private mapFinishReason(reason?: string): FinishReason {
    switch (reason) {
      case "STOP":
        return "stop";
      case "MAX_TOKENS":
        return "length";
      case "SAFETY":
      case "RECITATION":
        return "content_filter";
      default:
        return "other";
    }
  }

  private formatContentParts(
    content: string | ChatContentPart[]
  ): Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> {
    if (typeof content === "string") {
      return [{ text: content }];
    }

    return content.map((part) => {
      if (part.type === "text") {
        return { text: part.text };
      }
      if (part.type === "image") {
        let base64Data = "";
        let mimeType = part.mimeType || "image/jpeg";

        if (typeof part.image === "string") {
          if (part.image.startsWith("data:")) {
            const match = part.image.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              mimeType = match[1];
              base64Data = match[2];
            } else {
              base64Data = part.image;
            }
          } else {
            base64Data = part.image;
          }
        } else if (part.image instanceof Uint8Array || part.image instanceof ArrayBuffer) {
          const uint8 = part.image instanceof Uint8Array ? part.image : new Uint8Array(part.image);
          if (typeof Buffer !== "undefined") {
            base64Data = Buffer.from(uint8).toString("base64");
          } else {
            base64Data = btoa(String.fromCharCode(...uint8));
          }
        }

        return {
          inlineData: {
            mimeType,
            data: base64Data
          }
        };
      }
      if (part.type === "audio" || part.type === "file") {
        let base64Data = "";
        if (typeof part.data === "string") {
          base64Data = part.data;
        } else {
          const uint8 = part.data instanceof Uint8Array ? part.data : new Uint8Array(part.data);
          if (typeof Buffer !== "undefined") {
            base64Data = Buffer.from(uint8).toString("base64");
          } else {
            base64Data = btoa(String.fromCharCode(...uint8));
          }
        }

        return {
          inlineData: {
            mimeType: part.mimeType,
            data: base64Data
          }
        };
      }
      return { text: "" };
    });
  }

  private buildRequestBody(options: ChatOptions): Record<string, unknown> {
    const contents: Array<Record<string, unknown>> = [];
    let systemInstruction: Record<string, unknown> | undefined = undefined;

    if (options.systemInstruction) {
      systemInstruction = {
        parts: [{ text: options.systemInstruction }]
      };
    }

    if (options.messages) {
      for (const msg of options.messages) {
        if (msg.role === "system") {
          const text = typeof msg.content === "string" ? msg.content : "";
          systemInstruction = { parts: [{ text }] };
        } else if (msg.role === "user") {
          contents.push({
            role: "user",
            parts: this.formatContentParts(msg.content)
          });
        } else if (msg.role === "assistant") {
          const parts: Array<Record<string, unknown>> = [];
          if (typeof msg.content === "string" && msg.content) {
            parts.push({ text: msg.content });
          }
          if (msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              parts.push({
                functionCall: {
                  name: tc.name,
                  args: tc.arguments
                }
              });
            }
          }
          contents.push({ role: "model", parts: parts.length > 0 ? parts : [{ text: "" }] });
        } else if (msg.role === "tool") {
          contents.push({
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: msg.name || "tool",
                  response: typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content
                }
              }
            ]
          });
        }
      }
    } else if (options.prompt) {
      contents.push({
        role: "user",
        parts: [{ text: options.prompt }]
      });
    }

    const generationConfig: Record<string, unknown> = {};
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
    if (options.topP !== undefined) generationConfig.topP = options.topP;
    if (options.topK !== undefined) generationConfig.topK = options.topK;
    if (options.stopSequences) generationConfig.stopSequences = options.stopSequences;

    // Structured JSON / Schema mode
    if (options.responseFormat?.type === "json") {
      generationConfig.responseMimeType = "application/json";
      if ("schema" in options.responseFormat && options.responseFormat.schema) {
        generationConfig.responseSchema = options.responseFormat.schema;
      }
    }

    const body: Record<string, unknown> = {
      contents,
      generationConfig
    };

    if (systemInstruction) {
      body.systemInstruction = systemInstruction;
    }

    // Tools
    if (options.tools && options.tools.length > 0) {
      body.tools = [
        {
          functionDeclarations: options.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }))
        }
      ];
    }

    return body;
  }

  private handleError(statusCode: number, errorData: unknown, model: string): never {
    const errorObj = typeof errorData === "object" && errorData !== null ? (errorData as Record<string, unknown>) : {};
    const nestedError = typeof errorObj.error === "object" && errorObj.error !== null ? (errorObj.error as Record<string, unknown>) : {};
    const message =
      (nestedError.message as string) ||
      (errorObj.message as string) ||
      `Gemini API Error (HTTP ${statusCode})`;

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
    const url = `${this.baseUrl}/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
    const body = this.buildRequestBody(options);

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
            functionCall?: { name: string; args?: Record<string, unknown> };
          }>;
        };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
      };
    };

    const candidate = data.candidates?.[0];
    let text = "";
    const toolCalls: ToolCall[] = [];

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          text += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${Math.random().toString(36).substring(2, 9)}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args || {}
          });
        }
      }
    }

    const usage: UsageInfo | undefined = data.usageMetadata
      ? {
          promptTokens: data.usageMetadata.promptTokenCount ?? 0,
          completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: data.usageMetadata.totalTokenCount ?? 0
        }
      : undefined;

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(candidate?.finishReason),
      usage,
      provider: this.name,
      model,
      rawResponse: data
    };
  }

  public async *stream(options: ChatOptions): AsyncIterable<AIChunk> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;
    const body = this.buildRequestBody(options);

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

    for await (const sse of parseSSEStream(response.body)) {
      if (!sse.data) continue;
      let data: {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
          finishReason?: string;
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      try {
        data = JSON.parse(sse.data);
      } catch {
        continue;
      }

      const candidate = data.candidates?.[0];
      let delta = "";
      if (candidate?.content?.parts) {
        for (const part of candidate.content.parts) {
          if (part.text) {
            delta += part.text;
          }
        }
      }

      accumulatedText += delta;

      const usage: UsageInfo | undefined = data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount ?? 0,
            completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: data.usageMetadata.totalTokenCount ?? 0
          }
        : undefined;

      yield {
        text: accumulatedText,
        delta,
        finishReason: candidate?.finishReason ? this.mapFinishReason(candidate.finishReason) : undefined,
        usage,
        rawChunk: data
      };
    }
  }

  public async embed(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const model = options.model || "text-embedding-004";
    const inputs = Array.isArray(options.input) ? options.input : [options.input];

    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const text of inputs) {
      const url = `${this.baseUrl}/v1beta/models/${model}:embedContent?key=${this.apiKey}`;
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: options.dimensions
        }),
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

      const data = (await response.json()) as { embedding?: { values?: number[] } };
      if (data.embedding?.values) {
        embeddings.push(data.embedding.values);
      }
    }

    return {
      embeddings,
      usage: {
        promptTokens: totalTokens,
        completionTokens: 0,
        totalTokens
      },
      provider: this.name,
      model
    };
  }
}

export function createGemini(config?: GeminiProviderConfig): GeminiProvider {
  return new GeminiProvider(config);
}
