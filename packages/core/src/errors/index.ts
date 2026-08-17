/**
 * Base Error class for all Vision Universal AI SDK errors
 */
export class VisionAIError extends Error {
  public readonly provider?: string;
  public readonly model?: string;
  public readonly statusCode?: number;
  public readonly retryable: boolean;
  public readonly rawError?: unknown;

  constructor(
    message: string,
    options?: {
      provider?: string;
      model?: string;
      statusCode?: number;
      retryable?: boolean;
      rawError?: unknown;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "VisionAIError";
    this.provider = options?.provider;
    this.model = options?.model;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
    this.rawError = options?.rawError;
  }
}

/**
 * Authentication or Authorization Error (Invalid API Key, permissions)
 */
export class AuthenticationError extends VisionAIError {
  constructor(message = "Invalid API Key or unauthorized access", options?: { provider?: string; model?: string; rawError?: unknown }) {
    super(message, { ...options, statusCode: 401, retryable: false });
    this.name = "AuthenticationError";
  }
}

/**
 * Rate Limit / Quota Exceeded Error
 */
export class RateLimitError extends VisionAIError {
  public readonly retryAfterMs?: number;

  constructor(
    message = "Rate limit or quota exceeded",
    options?: {
      provider?: string;
      model?: string;
      retryAfterMs?: number;
      rawError?: unknown;
    }
  ) {
    super(message, { ...options, statusCode: 429, retryable: true });
    this.name = "RateLimitError";
    this.retryAfterMs = options?.retryAfterMs;
  }
}

/**
 * Request Timeout Error
 */
export class TimeoutError extends VisionAIError {
  constructor(message = "Request timed out", options?: { provider?: string; model?: string; rawError?: unknown }) {
    super(message, { ...options, statusCode: 408, retryable: true });
    this.name = "TimeoutError";
  }
}

/**
 * Invalid Request / Bad Request Error (Malformed JSON, invalid params, context length exceeded)
 */
export class InvalidRequestError extends VisionAIError {
  constructor(message: string, options?: { provider?: string; model?: string; rawError?: unknown }) {
    super(message, { ...options, statusCode: 400, retryable: false });
    this.name = "InvalidRequestError";
  }
}

/**
 * Provider Unavailable / Server Error (500, 502, 503, 504)
 */
export class ProviderUnavailableError extends VisionAIError {
  constructor(message = "Provider server is currently unavailable", options?: { provider?: string; model?: string; statusCode?: number; rawError?: unknown }) {
    super(message, { ...options, statusCode: options?.statusCode ?? 503, retryable: true });
    this.name = "ProviderUnavailableError";
  }
}

/**
 * Capability Not Supported Error (e.g. calling embed() on a provider without embedding support)
 */
export class CapabilityNotSupportedError extends VisionAIError {
  constructor(capability: string, provider: string) {
    super(`Provider '${provider}' does not support '${capability}'`, {
      provider,
      retryable: false
    });
    this.name = "CapabilityNotSupportedError";
  }
}

/**
 * Alias for CapabilityNotSupportedError
 */
export const UnsupportedFeatureError = CapabilityNotSupportedError;

/**
 * Structured Output Schema Validation Error
 */
export class SchemaValidationError extends VisionAIError {
  public readonly rawText?: string;
  public readonly validationErrors?: unknown[];

  constructor(
    message: string,
    options?: {
      provider?: string;
      model?: string;
      rawText?: string;
      validationErrors?: unknown[];
      rawError?: unknown;
    }
  ) {
    super(message, { ...options, retryable: true });
    this.name = "SchemaValidationError";
    this.rawText = options?.rawText;
    this.validationErrors = options?.validationErrors;
  }
}

/**
 * Tool Execution Error
 */
export class ToolExecutionError extends VisionAIError {
  public readonly toolName: string;

  constructor(toolName: string, message: string, cause?: Error) {
    super(`Error executing tool '${toolName}': ${message}`, {
      retryable: false,
      cause
    });
    this.name = "ToolExecutionError";
    this.toolName = toolName;
  }
}

/**
 * Normalizes any error or response into a standard VisionAIError subclass
 */
export function normalizeError(
  err: unknown,
  provider = "unknown",
  model = "unknown"
): VisionAIError {
  if (err instanceof VisionAIError) {
    return err;
  }

  if (err instanceof Error) {
    const msg = err.message.toLowerCase();

    if (err.name === "AbortError" || msg.includes("timeout") || msg.includes("aborted")) {
      return new TimeoutError(err.message, { provider, model, rawError: err });
    }

    if (msg.includes("api key") || msg.includes("unauthorized") || msg.includes("401") || msg.includes("forbidden") || msg.includes("403")) {
      return new AuthenticationError(err.message, { provider, model, rawError: err });
    }

    if (msg.includes("rate limit") || msg.includes("quota") || msg.includes("429") || msg.includes("too many requests")) {
      return new RateLimitError(err.message, { provider, model, rawError: err });
    }

    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504") || msg.includes("overloaded") || msg.includes("econnreset")) {
      return new ProviderUnavailableError(err.message, { provider, model, rawError: err });
    }

    if (msg.includes("400") || msg.includes("invalid") || msg.includes("context length")) {
      return new InvalidRequestError(err.message, { provider, model, rawError: err });
    }

    return new VisionAIError(err.message, { provider, model, rawError: err, cause: err });
  }

  return new VisionAIError(String(err), { provider, model, rawError: err });
}
