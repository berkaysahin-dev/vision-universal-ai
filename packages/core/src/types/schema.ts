import type { ChatOptions, UsageInfo } from "./chat.js";

/**
 * Standard JSON Schema subset
 */
export interface JSONSchema {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: (string | number | boolean | null)[];
  additionalProperties?: boolean | JSONSchema;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  [key: string]: unknown;
}

/**
 * Supported response formats
 */
export type ResponseFormat =
  | { type: "text" }
  | { type: "json" }
  | {
      type: "json";
      schema: JSONSchema;
      name?: string;
      description?: string;
      strict?: boolean;
    };

/**
 * Structured generation options
 */
export interface GenerateStructuredOptions<T = unknown> extends Omit<ChatOptions, "responseFormat"> {
  responseFormat: {
    type: "json";
    schema: JSONSchema;
    name?: string;
    description?: string;
    strict?: boolean;
  };
  validate?: (parsed: unknown) => T;
}

/**
 * Structured generation response
 */
export interface StructuredResponse<T = unknown> {
  data: T;
  rawText: string;
  usage?: UsageInfo;
  provider: string;
  model: string;
}
