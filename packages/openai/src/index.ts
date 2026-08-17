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
  type ImageGenerationOptions,
  type ImageGenerationResponse,
  type UsageInfo,
  VisionAIError,
  AuthenticationError,
  RateLimitError,
  InvalidRequestError,
  ProviderUnavailableError,
  parseSSEStream
} from "@vision-ai/core";

export interface OpenAIProviderConfig extends ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
}

export class OpenAIProvider implements AIProvider {
  public readonly name: string = "openai";
  public readonly displayName: string = "OpenAI";
  public readonly defaultModel: string;
  public readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    tools: true,
    vision: true,
    audioInput: true,
    pdfInput: false,
    jsonSchema: true,
    embeddings: true,
    imageGeneration: true,
    speechToText: true,
    textToSpeech: true
  };

  protected apiKey: string;
  protected baseUrl: string;
  protected organization?: string;
  protected project?: string;
  protected fetchFn: typeof globalThis.fetch;

  constructor(config: OpenAIProviderConfig = {}) {
    this.apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.OPENAI_API_KEY || "" : "");
    this.baseUrl = (config.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
    this.defaultModel = config.defaultModel || "gpt-4o";
    this.organization = config.organization;
    this.project = config.project;
    this.fetchFn = config.fetch || globalThis.fetch.bind(globalThis);
  }

  protected mapFinishReason(reason?: string): FinishReason {
    switch (reason) {
      case "stop":
        return "stop";
      case "length":
        return "length";
      case "tool_calls":
        return "tool_calls";
      case "content_filter":
        return "content_filter";
      default:
        return "other";
    }
  }

  protected formatContentParts(
    content: string | ChatContentPart[]
  ): string | Array<Record<string, unknown>> {
    if (typeof content === "string") {
      return content;
    }

    return content.map((part) => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      }
      if (part.type === "image") {
        let imageUrl = "";
        if (typeof part.image === "string") {
          imageUrl = part.image;
        } else {
          const uint8 = part.image instanceof Uint8Array ? part.image : new Uint8Array(part.image);
          const mime = part.mimeType || "image/jpeg";
          const base64 =
            typeof Buffer !== "undefined"
              ? Buffer.from(uint8).toString("base64")
              : btoa(String.fromCharCode(...uint8));
          imageUrl = `data:${mime};base64,${base64}`;
        }
        return {
          type: "image_url",
          image_url: {
            url: imageUrl,
            detail: part.detail || "auto"
          }
        };
      }
      return { type: "text", text: "" };
    });
  }

  protected buildRequestBody(options: ChatOptions, stream = false): Record<string, unknown> {
    const messages: Array<Record<string, unknown>> = [];

    if (options.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }

    if (options.messages) {
      for (const msg of options.messages) {
        if (msg.role === "tool") {
          messages.push({
            role: "tool",
            tool_call_id: msg.toolCallId || "",
            content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)
          });
        } else if (msg.role === "assistant" && msg.toolCalls) {
          messages.push({
            role: "assistant",
            content: typeof msg.content === "string" ? msg.content : null,
            tool_calls: msg.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.name,
                arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments)
              }
            }))
          });
        } else {
          messages.push({
            role: msg.role,
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
      messages
    };

    if (stream) {
      body.stream = true;
      body.stream_options = { include_usage: true };
    }

    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.frequencyPenalty !== undefined) body.frequency_penalty = options.frequencyPenalty;
    if (options.presencePenalty !== undefined) body.presence_penalty = options.presencePenalty;
    if (options.stopSequences) body.stop = options.stopSequences;

    // Structured JSON Schema / JSON Object
    if (options.responseFormat) {
      if (options.responseFormat.type === "json") {
        if ("schema" in options.responseFormat && options.responseFormat.schema) {
          body.response_format = {
            type: "json_schema",
            json_schema: {
              name: options.responseFormat.name || "structured_response",
              description: options.responseFormat.description,
              schema: options.responseFormat.schema,
              strict: options.responseFormat.strict ?? true
            }
          };
        } else {
          body.response_format = { type: "json_object" };
        }
      }
    }

    // Tools
    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      }));

      if (options.toolChoice) {
        if (typeof options.toolChoice === "string") {
          body.tool_choice = options.toolChoice;
        } else if (options.toolChoice.type === "tool") {
          body.tool_choice = {
            type: "function",
            function: { name: options.toolChoice.name }
          };
        }
      }
    }

    return body;
  }

  protected getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`
    };
    if (this.organization) {
      headers["OpenAI-Organization"] = this.organization;
    }
    if (this.project) {
      headers["OpenAI-Project"] = this.project;
    }
    return { ...headers, ...extraHeaders };
  }

  protected handleError(statusCode: number, errorData: unknown, model: string): never {
    const errorObj = typeof errorData === "object" && errorData !== null ? (errorData as Record<string, unknown>) : {};
    const nestedError = typeof errorObj.error === "object" && errorObj.error !== null ? (errorObj.error as Record<string, unknown>) : {};
    const message =
      (nestedError.message as string) ||
      (errorObj.message as string) ||
      `OpenAI API Error (HTTP ${statusCode})`;

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
    const url = `${this.baseUrl}/chat/completions`;
    const body = this.buildRequestBody(options, false);

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: this.getHeaders(options.headers),
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
      id?: string;
      model?: string;
      choices?: Array<{
        message?: {
          role?: string;
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };

    const choice = data.choices?.[0];
    const message = choice?.message;
    const text = message?.content || "";
    const toolCalls: ToolCall[] = [];

    if (message?.tool_calls) {
      for (const tc of message.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = { raw: tc.function.arguments };
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          arguments: args,
          rawArguments: tc.function.arguments
        });
      }
    }

    const usage: UsageInfo | undefined = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
          reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens
        }
      : undefined;

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(choice?.finish_reason),
      usage,
      provider: this.name,
      model: data.model || model,
      rawResponse: data
    };
  }

  public async *stream(options: ChatOptions): AsyncIterable<AIChunk> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;
    const body = this.buildRequestBody(options, true);

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: this.getHeaders(options.headers),
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
      if (!sse.data || sse.data === "[DONE]") continue;

      let data: {
        choices?: Array<{
          delta?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      try {
        data = JSON.parse(sse.data);
      } catch {
        continue;
      }

      const choice = data.choices?.[0];
      const deltaText = choice?.delta?.content || "";
      accumulatedText += deltaText;

      const usage: UsageInfo | undefined = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0
          }
        : undefined;

      yield {
        text: accumulatedText,
        delta: deltaText,
        finishReason: choice?.finish_reason ? this.mapFinishReason(choice.finish_reason) : undefined,
        usage,
        rawChunk: data
      };
    }
  }

  public async embed(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const model = options.model || "text-embedding-3-small";
    const url = `${this.baseUrl}/embeddings`;

    const body: Record<string, unknown> = {
      model,
      input: options.input
    };
    if (options.dimensions) body.dimensions = options.dimensions;

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: this.getHeaders(options.headers),
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
      data?: Array<{ embedding: number[] }>;
      model?: string;
      usage?: { prompt_tokens?: number; total_tokens?: number };
    };
    const embeddings = data.data?.map((item) => item.embedding) || [];

    const usage: UsageInfo | undefined = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: 0,
          totalTokens: data.usage.total_tokens ?? 0
        }
      : undefined;

    return {
      embeddings,
      usage,
      provider: this.name,
      model: data.model || model
    };
  }

  public async generateImage(options: ImageGenerationOptions): Promise<ImageGenerationResponse> {
    const model = options.model || "dall-e-3";
    const url = `${this.baseUrl}/images/generations`;

    const body: Record<string, unknown> = {
      model,
      prompt: options.prompt,
      n: options.n ?? 1,
      size: options.size || "1024x1024",
      response_format: options.responseFormat || "url"
    };
    if (options.quality) body.quality = options.quality;
    if (options.style) body.style = options.style;

    const response = await this.fetchFn(url, {
      method: "POST",
      headers: this.getHeaders(options.headers),
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
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>;
      created?: number;
    };
    const images = (data.data || []).map((img) => ({
      url: img.url,
      b64Json: img.b64_json,
      revisedPrompt: img.revised_prompt
    }));

    return {
      images,
      created: data.created || Date.now(),
      provider: this.name,
      model
    };
  }
}

export function createOpenAI(config?: OpenAIProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config);
}
