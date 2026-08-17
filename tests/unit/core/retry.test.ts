import { describe, it, expect, vi } from "vitest";
import { withRetry, calculateBackoff } from "@vision-ai/core";
import { RateLimitError, AuthenticationError } from "@vision-ai/core";

describe("Retry & Backoff Mechanism", () => {
  it("should succeed on the first attempt if no error occurs", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withRetry(fn, { maxRetries: 3 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable errors until success", async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) {
        throw new RateLimitError("Rate limited");
      }
      return "recovered";
    });

    const onRetry = vi.fn();
    const result = await withRetry(fn, {
      maxRetries: 3,
      initialDelayMs: 10,
      maxDelayMs: 50,
      jitter: false,
      onRetry
    });

    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it("should not retry non-retryable errors", async () => {
    const fn = vi.fn().mockImplementation(async () => {
      throw new AuthenticationError("Invalid API key");
    });

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow(AuthenticationError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should calculate backoff within bounds", () => {
    const delay = calculateBackoff(2, 100, 1000, 2, false);
    expect(delay).toBe(200);

    const delayMax = calculateBackoff(10, 100, 500, 2, false);
    expect(delayMax).toBe(500);
  });
});
