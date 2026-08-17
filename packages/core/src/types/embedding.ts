import type { UsageInfo } from "./chat.js";

/**
 * Options for generating vector embeddings
 */
export interface EmbeddingOptions {
  input: string | string[];
  model?: string;
  dimensions?: number;
  abortSignal?: AbortSignal;
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  extra?: Record<string, unknown>;
}

/**
 * Response containing vector embeddings
 */
export interface EmbeddingResponse {
  embeddings: number[][];
  usage?: UsageInfo;
  provider: string;
  model: string;
}
