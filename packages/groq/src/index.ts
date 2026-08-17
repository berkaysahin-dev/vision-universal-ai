import { OpenAIProvider, type OpenAIProviderConfig } from "@vision-ai/openai";
import type { ProviderCapabilities } from "@vision-ai/core";

export interface GroqProviderConfig extends OpenAIProviderConfig {}

export class GroqProvider extends OpenAIProvider {
  public override readonly name: string = "groq";
  public override readonly displayName: string = "Groq";
  public override readonly defaultModel: string;
  public override readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    tools: true,
    vision: true,
    audioInput: true,
    pdfInput: false,
    jsonSchema: true,
    embeddings: false,
    imageGeneration: false,
    speechToText: true,
    textToSpeech: false
  };

  constructor(config: GroqProviderConfig = {}) {
    const apiKey = config.apiKey || (typeof process !== "undefined" ? process.env?.GROQ_API_KEY || "" : "");
    const baseUrl = config.baseUrl || "https://api.groq.com/openai/v1";
    super({
      ...config,
      apiKey,
      baseUrl
    });
    this.defaultModel = config.defaultModel || "llama-3.3-70b-versatile";
  }
}

export function createGroq(config?: GroqProviderConfig): GroqProvider {
  return new GroqProvider(config);
}
