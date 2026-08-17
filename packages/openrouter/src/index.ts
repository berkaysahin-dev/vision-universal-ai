import { OpenAIProvider, type OpenAIProviderConfig } from "@vision-ai/openai";
import type { ProviderCapabilities } from "@vision-ai/core";

export interface OpenRouterConfig extends OpenAIProviderConfig {
  siteUrl?: string;
  siteName?: string;
}

export class OpenRouterProvider extends OpenAIProvider {
  public override readonly name: string = "openrouter";
  public override readonly displayName: string = "OpenRouter";
  public override readonly defaultModel: string;
  public override readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    tools: true,
    vision: true,
    audioInput: true,
    pdfInput: true,
    jsonSchema: true,
    embeddings: false,
    imageGeneration: false,
    speechToText: false,
    textToSpeech: false
  };

  private siteUrl?: string;
  private siteName?: string;

  constructor(config: OpenRouterConfig = {}) {
    const apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.OPENROUTER_API_KEY || "" : "");
    const baseUrl = config.baseUrl || "https://openrouter.ai/api/v1";
    super({
      ...config,
      apiKey,
      baseUrl
    });
    this.defaultModel = config.defaultModel || "meta-llama/llama-3.3-70b-instruct";
    this.siteUrl = config.siteUrl;
    this.siteName = config.siteName;
  }

  protected override getHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
    const headers = super.getHeaders(extraHeaders);
    if (this.siteUrl) {
      headers["HTTP-Referer"] = this.siteUrl;
    }
    if (this.siteName) {
      headers["X-Title"] = this.siteName;
    }
    return headers;
  }
}

export function createOpenRouter(config?: OpenRouterConfig): OpenRouterProvider {
  return new OpenRouterProvider(config);
}
