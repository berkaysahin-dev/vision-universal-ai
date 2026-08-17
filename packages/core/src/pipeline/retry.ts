import { VisionAIError } from "../errors/index.js";

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds (default: 500ms)
   */
  initialDelayMs?: number;

  /**
   * Maximum delay in milliseconds (default: 10000ms)
   */
  maxDelayMs?: number;

  /**
   * Exponential factor (default: 2)
   */
  backoffFactor?: number;

  /**
   * Add randomized jitter (default: true)
   */
  jitter?: boolean;

  /**
   * Optional custom predicate for whether an error is retryable
   */
  isRetryable?: (error: unknown) => boolean;

  /**
   * Optional callback when a retry is triggered
   */
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;

  /**
   * Abort signal to cancel pending retries
   */
  abortSignal?: AbortSignal;
}

/**
 * Calculates backoff delay with optional jitter
 */
export function calculateBackoff(
  attempt: number,
  initialDelayMs = 500,
  maxDelayMs = 10000,
  backoffFactor = 2,
  jitter = true
): number {
  const base = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
  const capped = Math.min(base, maxDelayMs);
  if (!jitter) return capped;
  // Full jitter: random value between 0.5 * capped and 1.5 * capped
  const min = capped * 0.5;
  const max = capped * 1.5;
  return Math.floor(min + Math.random() * (max - min));
}

/**
 * Executes an async operation with automated exponential backoff retries
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 500;
  const maxDelay = options.maxDelayMs ?? 10000;
  const factor = options.backoffFactor ?? 2;
  const jitter = options.jitter ?? true;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    if (options.abortSignal?.aborted) {
      throw new VisionAIError("Operation cancelled by AbortSignal", { retryable: false });
    }

    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;

      // Check if we've exhausted all retries
      if (attempt > maxRetries) {
        break;
      }

      // Check if error is retryable
      let shouldRetry = true;
      if (options.isRetryable) {
        shouldRetry = options.isRetryable(err);
      } else if (err instanceof VisionAIError) {
        shouldRetry = err.retryable;
      }

      if (!shouldRetry) {
        throw err;
      }

      // Check if error specified retry-after header
      let delayMs = calculateBackoff(attempt, initialDelay, maxDelay, factor, jitter);
      if (err && typeof err === "object" && "retryAfterMs" in err && typeof (err as { retryAfterMs?: number }).retryAfterMs === "number") {
        delayMs = Math.min((err as { retryAfterMs: number }).retryAfterMs, maxDelay);
      }

      options.onRetry?.(attempt, err, delayMs);

      // Wait before next attempt
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          options.abortSignal?.removeEventListener("abort", onAbort);
          resolve();
        }, delayMs);

        const onAbort = () => {
          clearTimeout(timer);
          reject(new VisionAIError("Operation cancelled during retry backoff", { retryable: false }));
        };

        options.abortSignal?.addEventListener("abort", onAbort, { once: true });
      });
    }
  }

  throw lastError;
}
