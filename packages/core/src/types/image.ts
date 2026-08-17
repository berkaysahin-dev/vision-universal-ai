/**
 * Options for generating images
 */
export interface ImageGenerationOptions {
  prompt: string;
  model?: string;
  n?: number;
  size?: "256x256" | "512x512" | "1024x1024" | "1792x1024" | "1024x1792" | string;
  responseFormat?: "url" | "b64_json";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Image item in response
 */
export interface GeneratedImage {
  url?: string;
  b64Json?: string;
  revisedPrompt?: string;
}

/**
 * Response from image generation
 */
export interface ImageGenerationResponse {
  images: GeneratedImage[];
  created: number;
  provider: string;
  model: string;
}
