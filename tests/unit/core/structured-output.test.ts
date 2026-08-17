import { describe, it, expect } from "vitest";
import {
  extractJSONText,
  parseStructuredJSON,
  SchemaValidationError
} from "@vision-ai/core";

describe("Structured Outputs & Schema Validation", () => {
  it("should extract JSON string enclosed in markdown code fences", () => {
    const raw = "Here is your requested JSON:\n```json\n{\n  \"name\": \"Vision AI\",\n  \"stars\": 5000\n}\n```\nHope that helps!";
    const extracted = extractJSONText(raw);
    expect(extracted).toBe('{\n  "name": "Vision AI",\n  "stars": 5000\n}');
  });

  it("should parse and validate against valid schema", () => {
    const jsonString = '{"product": "Smart Glass", "price": 299.99, "available": true}';
    const schema = {
      type: "object",
      properties: {
        product: { type: "string" },
        price: { type: "number" },
        available: { type: "boolean" }
      },
      required: ["product", "price"]
    };

    const parsed = parseStructuredJSON<{ product: string; price: number; available: boolean }>(
      jsonString,
      schema,
      "openai",
      "gpt-4o"
    );

    expect(parsed.product).toBe("Smart Glass");
    expect(parsed.price).toBe(299.99);
    expect(parsed.available).toBe(true);
  });

  it("should throw SchemaValidationError when required field is missing", () => {
    const invalidJson = '{"price": 100}';
    const schema = {
      type: "object",
      properties: {
        title: { type: "string" },
        price: { type: "number" }
      },
      required: ["title", "price"]
    };

    expect(() => parseStructuredJSON(invalidJson, schema)).toThrow(SchemaValidationError);
  });
});
