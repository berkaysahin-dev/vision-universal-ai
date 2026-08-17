import { OpenAIProvider, type OpenAIProviderConfig } from "@vision-ai/openai";
import type { ProviderCapabilities } from "@vision-ai/core";

export interface MistralProviderConfig extends OpenAIProviderConfig {}

export class MistralProvider extends OpenAIProvider {
  public override readonly name: string = "mistral";
  public override readonly displayName: string = "Mistral AI";
  public override readonly defaultModel: string;
  public override readonly capabilities: ProviderCapabilities = {
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

  constructor(config: MistralProviderConfig = {}) {
    const apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.MISTRAL_API_KEY || "" : "");
    const baseUrl = config.baseUrl || "https://api.mistral.ai/v1";
    super({
      ...config,
      apiKey,
      baseUrl
    });
    this.defaultModel = config.defaultModel || "mistral-large-latest";
  }
}

export function createMistral(config?: MistralProviderConfig): MistralProvider {
  return new MistralProvider(config);
}
