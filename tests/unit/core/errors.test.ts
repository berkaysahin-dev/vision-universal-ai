import { describe, it, expect } from "vitest";
import {
  normalizeError,
  VisionAIError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  ProviderUnavailableError,
  CapabilityNotSupportedError,
  UnsupportedFeatureError
} from "@vision-ai/core";

describe("Error Normalization", () => {
  it("should preserve existing VisionAIError subclasses", () => {
    const original = new RateLimitError("Too many requests", { provider: "gemini", model: "gemini-2.0-flash" });
    const normalized = normalizeError(original);
    expect(normalized).toBe(original);
    expect(normalized instanceof RateLimitError).toBe(true);
    expect(normalized.statusCode).toBe(429);
  });

  it("should map 401 unauthorized to AuthenticationError", () => {
    const raw = new Error("HTTP 401: Invalid API Key provided");
    const normalized = normalizeError(raw, "openai", "gpt-4o");
    expect(normalized instanceof AuthenticationError).toBe(true);
    expect(normalized.statusCode).toBe(401);
    expect(normalized.provider).toBe("openai");
    expect(normalized.retryable).toBe(false);
  });

  it("should map rate limit messages to RateLimitError", () => {
    const raw = new Error("Rate limit exceeded for model gemini-1.5-pro");
    const normalized = normalizeError(raw, "gemini");
    expect(normalized instanceof RateLimitError).toBe(true);
    expect(normalized.retryable).toBe(true);
  });

  it("should map 503 unavailable to ProviderUnavailableError", () => {
    const raw = new Error("503 Service Unavailable: Server overloaded");
    const normalized = normalizeError(raw, "anthropic");
    expect(normalized instanceof ProviderUnavailableError).toBe(true);
    expect(normalized.retryable).toBe(true);
  });

  it("should support UnsupportedFeatureError alias", () => {
    const err = new UnsupportedFeatureError("embed", "anthropic");
    expect(err instanceof CapabilityNotSupportedError).toBe(true);
    expect(err.message).toContain("Provider 'anthropic' does not support 'embed'");
  });
});
