import type { JSONSchema } from "./schema.js";

/**
 * Universal Tool Definition
 */
export interface AIToolDefinition {
  name: string;
  description: string;
  parameters?: JSONSchema;
}

/**
 * Tool with executable logic
 */
export interface AITool<TParams = Record<string, unknown>, TResult = unknown> {
  name: string;
  description: string;
  parameters?: JSONSchema;
  execute?: (args: TParams) => Promise<TResult> | TResult;
}

/**
 * Tool call requested by the LLM
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  rawArguments?: string;
}

/**
 * Result of an executed tool call
 */
export interface ToolResult {
  toolCallId: string;
  name: string;
  result: unknown;
  error?: string;
}
