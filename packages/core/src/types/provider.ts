import type { ChatOptions, AIResponse, AIChunk } from "./chat.js";
import type { EmbeddingOptions, EmbeddingResponse } from "./embedding.js";
import type { ImageGenerationOptions, ImageGenerationResponse } from "./image.js";
import type { TranscriptionOptions, TranscriptionResponse, SpeechOptions, SpeechResponse } from "./audio.js";

/**
 * Feature capability flags for a provider
 */
export interface ProviderCapabilities {
  chat: boolean;
  stream: boolean;
  tools: boolean;
  vision: boolean;
  audioInput: boolean;
  pdfInput: boolean;
  jsonSchema: boolean;
  embeddings: boolean;
  imageGeneration: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
}

/**
 * Common configuration for any AI Provider instance
 */
export interface ProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  organization?: string;
  project?: string;
  timeoutMs?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  extra?: Record<string, unknown>;
}

/**
 * Standard AI Provider Interface
 * All concrete providers (Gemini, OpenAI, Claude, etc.) implement this contract.
 */
export interface AIProvider {
  /**
   * Unique name of the provider (e.g. 'gemini', 'openai', 'anthropic')
   */
  readonly name: string;

  /**
   * Human-readable label
   */
  readonly displayName: string;

  /**
   * Default model used when none is specified
   */
  readonly defaultModel: string;

  /**
   * Capabilities supported by this provider
   */
  readonly capabilities: ProviderCapabilities;

  /**
   * Core chat generation
   */
  chat(options: ChatOptions): Promise<AIResponse>;

  /**
   * Real-time streaming chat generation
   */
  stream(options: ChatOptions): AsyncIterable<AIChunk>;

  /**
   * Vector embeddings generation (optional)
   */
  embed?(options: EmbeddingOptions): Promise<EmbeddingResponse>;

  /**
   * Image generation (optional)
   */
  generateImage?(options: ImageGenerationOptions): Promise<ImageGenerationResponse>;

  /**
   * Audio transcription (optional)
   */
  transcribe?(options: TranscriptionOptions): Promise<TranscriptionResponse>;

  /**
   * Text to speech generation (optional)
   */
  speak?(options: SpeechOptions): Promise<SpeechResponse>;
}
