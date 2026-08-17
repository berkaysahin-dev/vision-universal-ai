/**
 * Simple in-memory sliding window rate limiter
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Checks if a request is allowed; if not, waits until a slot is free
   */
  public async acquire(): Promise<void> {
    while (true) {
      const now = Date.now();
      // Remove timestamps outside the sliding window
      this.requests = this.requests.filter((ts) => now - ts < this.windowMs);

      if (this.requests.length < this.maxRequests) {
        this.requests.push(now);
        return;
      }

      // Wait until oldest request falls outside the window
      const oldest = this.requests[0];
      const waitMs = Math.max(50, oldest + this.windowMs - now);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}
