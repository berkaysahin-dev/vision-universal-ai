import type { JSONSchema } from "../types/schema.js";
import { SchemaValidationError } from "../errors/index.js";

/**
 * Extracts raw JSON substring from LLM response text (strips markdown code blocks)
 */
export function extractJSONText(text: string): string {
  const trimmed = text.trim();

  // Match ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }

  // Find first '{' or '[' and matching last '}' or ']'
  const firstBrace = trimmed.indexOf("{");
  const firstBracket = trimmed.indexOf("[");

  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else if (firstBrace !== -1) {
    start = firstBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
  }

  if (start !== -1) {
    const isObject = trimmed[start] === "{";
    const last = isObject ? trimmed.lastIndexOf("}") : trimmed.lastIndexOf("]");
    if (last !== -1 && last > start) {
      return trimmed.slice(start, last + 1);
    }
  }

  return trimmed;
}

/**
 * Lightweight JSON schema validation utility
 */
export function validateAgainstSchema(
  data: unknown,
  schema?: JSONSchema,
  path = ""
): { valid: boolean; errors: string[] } {
  if (!schema) return { valid: true, errors: [] };

  const errors: string[] = [];

  // Check type
  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = Array.isArray(data) ? "array" : data === null ? "null" : typeof data;

    if (!expectedTypes.includes(actualType)) {
      errors.push(`At ${path || "root"}: expected type '${expectedTypes.join(" | ")}', got '${actualType}'`);
      return { valid: false, errors };
    }
  }

  // Check object properties and required fields
  if (schema.type === "object" && typeof data === "object" && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    if (schema.required) {
      for (const req of schema.required) {
        if (!(req in obj) || obj[req] === undefined) {
          errors.push(`At ${path || "root"}: missing required property '${req}'`);
        }
      }
    }

    if (schema.properties) {
      for (const [propKey, propSchema] of Object.entries(schema.properties)) {
        if (propKey in obj && obj[propKey] !== undefined) {
          const sub = validateAgainstSchema(obj[propKey], propSchema, path ? `${path}.${propKey}` : propKey);
          errors.push(...sub.errors);
        }
      }
    }
  }

  // Check array items
  if (schema.type === "array" && Array.isArray(data) && schema.items) {
    data.forEach((item, idx) => {
      const sub = validateAgainstSchema(item, schema.items, `${path}[${idx}]`);
      errors.push(...sub.errors);
    });
  }

  // Check enum
  if (schema.enum && !schema.enum.includes(data as string | number | boolean | null)) {
    errors.push(`At ${path || "root"}: value must be one of [${schema.enum.join(", ")}]`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Parses and validates structured JSON output from LLM
 */
export function parseStructuredJSON<T = unknown>(
  text: string,
  schema?: JSONSchema,
  provider = "unknown",
  model = "unknown"
): T {
  const jsonText = extractJSONText(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new SchemaValidationError(
      `Failed to parse model response as valid JSON: ${(err as Error).message}`,
      { provider, model, rawText: text, rawError: err }
    );
  }

  if (schema) {
    const validation = validateAgainstSchema(parsed, schema);
    if (!validation.valid) {
      throw new SchemaValidationError(
        `JSON schema validation failed: ${validation.errors.join("; ")}`,
        { provider, model, rawText: text, validationErrors: validation.errors }
      );
    }
  }

  return parsed as T;
}
