import { OpenAIProvider, type OpenAIProviderConfig } from "@vision-ai/openai";
import type { ProviderCapabilities, ChatOptions, AIResponse, AIChunk, ToolCall, UsageInfo } from "@vision-ai/core";
import { parseSSEStream } from "@vision-ai/core";

export interface DeepSeekProviderConfig extends OpenAIProviderConfig {}

export class DeepSeekProvider extends OpenAIProvider {
  public override readonly name: string = "deepseek";
  public override readonly displayName: string = "DeepSeek";
  public override readonly defaultModel: string;
  public override readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    tools: true,
    vision: false,
    audioInput: false,
    pdfInput: false,
    jsonSchema: true,
    embeddings: false,
    imageGeneration: false,
    speechToText: false,
    textToSpeech: false
  };

  constructor(config: DeepSeekProviderConfig = {}) {
    const apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.DEEPSEEK_API_KEY || "" : "");
    const baseUrl = config.baseUrl || "https://api.deepseek.com";
    super({
      ...config,
      apiKey,
      baseUrl
    });
    this.defaultModel = config.defaultModel || "deepseek-chat";
  }

  public override async chat(options: ChatOptions): Promise<AIResponse> {
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
      let errJson: any;
      try {
        errJson = await response.json();
      } catch {
        errJson = { message: await response.text() };
      }
      this.handleError(response.status, errJson, model);
    }

    const data: any = await response.json();
    const choice = data.choices?.[0];
    const message = choice?.message;
    const text = message?.content || "";
    const reasoningContent = message?.reasoning_content;
    const toolCalls: ToolCall[] = [];

    if (message?.tool_calls) {
      for (const tc of message.tool_calls) {
        let args = {};
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
      reasoningContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapFinishReason(choice?.finish_reason),
      usage,
      provider: this.name,
      model: data.model || model,
      rawResponse: data
    };
  }

  public override async *stream(options: ChatOptions): AsyncIterable<AIChunk> {
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
      let errJson: any;
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

      let data: any;
      try {
        data = JSON.parse(sse.data);
      } catch {
        continue;
      }

      const choice = data.choices?.[0];
      const deltaText = choice?.delta?.content || "";
      const reasoningDelta = choice?.delta?.reasoning_content || undefined;
      accumulatedText += deltaText;

      const usage: UsageInfo | undefined = data.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
            totalTokens: data.usage.total_tokens ?? 0,
            reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens
          }
        : undefined;

      yield {
        text: accumulatedText,
        delta: deltaText,
        reasoningDelta,
        finishReason: choice?.finish_reason ? this.mapFinishReason(choice.finish_reason) : undefined,
        usage,
        rawChunk: data
      };
    }
  }
}

export function createDeepSeek(config?: DeepSeekProviderConfig): DeepSeekProvider {
  return new DeepSeekProvider(config);
}
