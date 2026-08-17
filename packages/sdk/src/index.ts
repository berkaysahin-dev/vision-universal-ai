import {
  VisionAI as CoreVisionAI,
  type VisionAIOptions,
  defaultRegistry
} from "@vision-ai/core";

import { GeminiProvider, createGemini } from "@vision-ai/gemini";
import { OpenAIProvider, createOpenAI } from "@vision-ai/openai";
import { AnthropicProvider, createAnthropic } from "@vision-ai/anthropic";
import { GroqProvider, createGroq } from "@vision-ai/groq";
import { DeepSeekProvider, createDeepSeek } from "@vision-ai/deepseek";
import { OpenRouterProvider, createOpenRouter } from "@vision-ai/openrouter";
import { OllamaProvider, createOllama } from "@vision-ai/ollama";
import { MistralProvider, createMistral } from "@vision-ai/mistral";

// Register default providers globally with environment variables if present
function registerDefaultProviders() {
  if (typeof process !== "undefined" && process.env) {
    if (process.env.GEMINI_API_KEY) {
      defaultRegistry.register(createGemini({ apiKey: process.env.GEMINI_API_KEY }));
    }
    if (process.env.OPENAI_API_KEY) {
      defaultRegistry.register(createOpenAI({ apiKey: process.env.OPENAI_API_KEY }));
    }
    if (process.env.ANTHROPIC_API_KEY) {
      defaultRegistry.register(createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
    }
    if (process.env.GROQ_API_KEY) {
      defaultRegistry.register(createGroq({ apiKey: process.env.GROQ_API_KEY }));
    }
    if (process.env.DEEPSEEK_API_KEY) {
      defaultRegistry.register(createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY }));
    }
    if (process.env.OPENROUTER_API_KEY) {
      defaultRegistry.register(createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY }));
    }
    if (process.env.MISTRAL_API_KEY) {
      defaultRegistry.register(createMistral({ apiKey: process.env.MISTRAL_API_KEY }));
    }
    // Always register local Ollama by default
    defaultRegistry.register(createOllama({ baseUrl: process.env.OLLAMA_HOST || "http://localhost:11434" }));
  }
}

registerDefaultProviders();

/**
 * Universal AI Client with built-in provider adaptors
 */
export class VisionAI extends CoreVisionAI {
  constructor(options: VisionAIOptions = {}) {
    const targetProvider = options.provider?.toLowerCase();
    const providers = [...(options.providers || [])];

    // If a specific provider was requested and not already provided in `options.providers`, instantiate its dedicated adapter
    const alreadyHas = targetProvider ? providers.some((p) => p.name.toLowerCase() === targetProvider) : false;

    if (targetProvider && !alreadyHas) {
      switch (targetProvider) {
        case "gemini":
          providers.push(createGemini({ apiKey: options.apiKey, baseUrl: options.baseUrl, defaultModel: options.defaultModel }));
          break;
        case "openai":
          providers.push(createOpenAI({ apiKey: options.apiKey, baseUrl: options.baseUrl, defaultModel: options.defaultModel }));
          break;
        case "anthropic":
          providers.push(createAnthropic({ apiKey: options.apiKey, baseUrl: options.baseUrl, defaultModel: options.defaultModel }));
          break;
        case "groq":
          providers.push(createGroq({ apiKey: options.apiKey, baseUrl: options.baseUrl, defaultModel: options.defaultModel }));
          break;
        case "deepseek":
          providers.push(createDeepSeek({ apiKey: options.apiKey, baseUrl: options.baseUrl, defaultModel: options.defaultModel }));
          break;
        case "openrouter":
          providers.push(createOpenRouter({ apiKey: options.apiKey, baseUrl: options.baseUrl, defaultModel: options.defaultModel }));
          break;
        case "ollama":
          providers.push(createOllama({ baseUrl: options.baseUrl, defaultModel: options.defaultModel }));
          break;
        case "mistral":
          providers.push(createMistral({ apiKey: options.apiKey, baseUrl: options.baseUrl, defaultModel: options.defaultModel }));
          break;
      }
    }

    // Determine auto fallback default provider if none specified
    let detectedDefault = options.provider;
    if (!detectedDefault && providers.length > 0) {
      detectedDefault = providers[0].name.toLowerCase();
    } else if (!detectedDefault && typeof process !== "undefined" && process.env) {
      if (process.env.GEMINI_API_KEY) detectedDefault = "gemini";
      else if (process.env.OPENAI_API_KEY) detectedDefault = "openai";
      else if (process.env.ANTHROPIC_API_KEY) detectedDefault = "anthropic";
      else if (process.env.GROQ_API_KEY) detectedDefault = "groq";
      else if (process.env.DEEPSEEK_API_KEY) detectedDefault = "deepseek";
      else if (process.env.OPENROUTER_API_KEY) detectedDefault = "openrouter";
      else if (process.env.MISTRAL_API_KEY) detectedDefault = "mistral";
      else detectedDefault = "ollama";
    }

    super({
      ...options,
      provider: detectedDefault,
      providers
    });
  }
}

/**
 * Factory helper for creating VisionAI
 */
export function createVisionAI(options?: VisionAIOptions): VisionAI {
  return new VisionAI(options);
}

// Export all core types and utilities
export * from "@vision-ai/core";

// Export provider classes and constructors
export {
  GeminiProvider,
  createGemini,
  OpenAIProvider,
  createOpenAI,
  AnthropicProvider,
  createAnthropic,
  GroqProvider,
  createGroq,
  DeepSeekProvider,
  createDeepSeek,
  OpenRouterProvider,
  createOpenRouter,
  OllamaProvider,
  createOllama,
  MistralProvider,
  createMistral
};
