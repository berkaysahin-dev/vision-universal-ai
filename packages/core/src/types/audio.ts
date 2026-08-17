/**
 * Speech to Text / Transcription options
 */
export interface TranscriptionOptions {
  file: Blob | Uint8Array | ArrayBuffer | string;
  model?: string;
  language?: string;
  prompt?: string;
  responseFormat?: "json" | "text" | "verbose_json";
  temperature?: number;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Transcription response
 */
export interface TranscriptionResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  provider: string;
  model: string;
}

/**
 * Text to Speech options
 */
export interface SpeechOptions {
  input: string;
  model?: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" | string;
  responseFormat?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
  speed?: number;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
}

/**
 * Speech generation response
 */
export interface SpeechResponse {
  audio: Uint8Array;
  mimeType: string;
  provider: string;
  model: string;
}
