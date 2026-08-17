import {
  type AIProvider,
  type ProviderCapabilities,
  type ProviderConfig,
  type ChatOptions,
  type ChatMessage,
  type AIResponse,
  type AIChunk,
  type ToolCall,
  type EmbeddingOptions,
  type EmbeddingResponse,
  type UsageInfo,
  VisionAIError,
  ProviderUnavailableError,
  InvalidRequestError
} from "@vision-ai/core";

export interface OllamaProviderConfig extends ProviderConfig {
  baseUrl?: string;
}

export class OllamaProvider implements AIProvider {
  public readonly name: string = "ollama";
  public readonly displayName: string = "Ollama (Local)";
  public readonly defaultModel: string;
  public readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    tools: true,
    vision: true,
    audioInput: false,
    pdfInput: false,
    jsonSchema: true,
    embeddings: true,
    imageGeneration: false,
    speechToText: false,
    textToSpeech: false
  };

  private baseUrl: string;
  private fetchFn: typeof globalThis.fetch;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = (
      config.baseUrl ||
      (typeof process !== "undefined" ? process.env?.OLLAMA_HOST || process.env?.OLLAMA_BASE_URL : "") ||
      "http://localhost:11434"
    ).replace(/\/$/, "");
    this.defaultModel = config.defaultModel || "llama3.2";
    this.fetchFn = config.fetch || globalThis.fetch.bind(globalThis);
  }

  private formatMessage(msg: ChatMessage): any {
    let content = "";
    const images: string[] = [];

    if (typeof msg.content === "string") {
      content = msg.content;
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          content += part.text;
        } else if (part.type === "image") {
          let b64 = "";
          if (typeof part.image === "string") {
            if (part.image.startsWith("data:")) {
              const match = part.image.match(/^data:[^;]+;base64,(.+)$/);
              b64 = match ? match[1] : part.image;
            } else {
              b64 = part.image;
            }
          } else {
            const uint8 = part.image instanceof Uint8Array ? part.image : new Uint8Array(part.image);
            b64 = typeof Buffer !== "undefined" ? Buffer.from(uint8).toString("base64") : btoa(String.fromCharCode(...uint8));
          }
          images.push(b64);
        }
      }
    }

    const res: Record<string, unknown> = {
      role: msg.role === "tool" ? "tool" : msg.role,
      content
    };

    if (images.length > 0) {
      res.images = images;
    }

    return res;
  }

  private buildRequestBody(options: ChatOptions, stream = false): Record<string, unknown> {
    const messages: any[] = [];

    if (options.systemInstruction) {
      messages.push({ role: "system", content: options.systemInstruction });
    }

    if (options.messages) {
      for (const msg of options.messages) {
        messages.push(this.formatMessage(msg));
      }
    } else if (options.prompt) {
      messages.push({ role: "user", content: options.prompt });
    }

    const body: Record<string, unknown> = {
      model: options.model || this.defaultModel,
      messages,
      stream
    };

    const ollamaOptions: Record<string, unknown> = {};
    if (options.temperature !== undefined) ollamaOptions.temperature = options.temperature;
    if (options.maxTokens !== undefined) ollamaOptions.num_predict = options.maxTokens;
    if (options.topP !== undefined) ollamaOptions.top_p = options.topP;
    if (options.topK !== undefined) ollamaOptions.top_k = options.topK;
    if (options.stopSequences) ollamaOptions.stop = options.stopSequences;

    if (Object.keys(ollamaOptions).length > 0) {
      body.options = ollamaOptions;
    }

    if (options.responseFormat?.type === "json") {
      body.format = "json";
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
    }

    return body;
  }

  public async chat(options: ChatOptions): Promise<AIResponse> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;
    const body = this.buildRequestBody(options, false);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify(body),
        signal: options.abortSignal
      });
    } catch (err) {
      throw new ProviderUnavailableError(`Failed to connect to local Ollama instance at ${this.baseUrl}`, {
        provider: this.name,
        model,
        rawError: err
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new InvalidRequestError(errText, { provider: this.name, model });
    }

    const data: any = await response.json();
    const msg = data.message;
    const text = msg?.content || "";
    const toolCalls: ToolCall[] = [];

    if (msg?.tool_calls) {
      for (const tc of msg.tool_calls) {
        toolCalls.push({
          id: `ollama_call_${Math.random().toString(36).substring(2, 9)}`,
          name: tc.function.name,
          arguments: tc.function.arguments || {}
        });
      }
    }

    const usage: UsageInfo | undefined = data.prompt_eval_count || data.eval_count
      ? {
          promptTokens: data.prompt_eval_count ?? 0,
          completionTokens: data.eval_count ?? 0,
          totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0)
        }
      : undefined;

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: data.done ? "stop" : "other",
      usage,
      provider: this.name,
      model: data.model || model,
      rawResponse: data
    };
  }

  public async *stream(options: ChatOptions): AsyncIterable<AIChunk> {
    const model = options.model || this.defaultModel;
    const url = `${this.baseUrl}/api/chat`;
    const body = this.buildRequestBody(options, true);

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify(body),
        signal: options.abortSignal
      });
    } catch (err) {
      throw new ProviderUnavailableError(`Failed to connect to local Ollama instance at ${this.baseUrl}`, {
        provider: this.name,
        model,
        rawError: err
      });
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new InvalidRequestError(errText, { provider: this.name, model });
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let accumulatedText = "";
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let data: any;
          try {
            data = JSON.parse(trimmed);
          } catch {
            continue;
          }

          const delta = data.message?.content || "";
          accumulatedText += delta;

          yield {
            text: accumulatedText,
            delta,
            finishReason: data.done ? "stop" : undefined,
            rawChunk: data
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  public async embed(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const model = options.model || this.defaultModel;
    const inputs = Array.isArray(options.input) ? options.input : [options.input];
    const embeddings: number[][] = [];

    for (const prompt of inputs) {
      const url = `${this.baseUrl}/api/embeddings`;
      const response = await this.fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify({ model, prompt }),
        signal: options.abortSignal
      });

      if (!response.ok) {
        throw new VisionAIError(`Ollama embedding error: ${await response.text()}`, {
          provider: this.name,
          model
        });
      }

      const data: any = await response.json();
      if (data.embedding) {
        embeddings.push(data.embedding);
      }
    }

    return {
      embeddings,
      provider: this.name,
      model
    };
  }
}

export function createOllama(config?: OllamaProviderConfig): OllamaProvider {
  return new OllamaProvider(config);
}
