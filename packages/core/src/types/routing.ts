/**
 * Fallback and Routing configuration
 */
export interface RoutingConfig {
  /**
   * Default provider key to use (e.g. 'gemini', 'openai', 'anthropic')
   */
  default: string;

  /**
   * Ordered fallback provider keys if the primary fails
   */
  fallback?: string[];

  /**
   * Strategy for model routing:
   * - 'fallback': Try default, on retryable error failover to fallback[0], then fallback[1], etc.
   * - 'round-robin': Load balance across available providers
   * - 'cost': Prefer lowest cost provider first
   * - 'latency': Route to fastest responding provider
   */
  strategy?: "fallback" | "round-robin" | "cost" | "latency";

  /**
   * Retry on 429 Rate Limit error by failing over immediately
   */
  fallbackOnRateLimit?: boolean;

  /**
   * Retry on 5xx Server Error by failing over immediately
   */
  fallbackOnServerError?: boolean;

  /**
   * Fallback on Request Timeout
   */
  fallbackOnTimeout?: boolean;

  /**
   * Callback invoked whenever a fallback routing event occurs
   */
  onFallback?: (event: {
    failedProvider: string;
    error: Error;
    nextProvider: string;
    attempt: number;
  }) => void;
}
