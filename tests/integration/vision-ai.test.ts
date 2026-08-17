import { describe, it, expect, vi } from "vitest";
import { VisionAI } from "vision-universal-ai";
import { MockProvider } from "../fixtures/mock-provider.js";

describe("VisionAI Unified Client Integration", () => {
  it("should initialize and execute chat with string prompt", async () => {
    const mock = new MockProvider("custom-mock", { responseText: "Universal response" });
    const ai = new VisionAI({
      provider: "custom-mock",
      providers: [mock]
    });

    const res = await ai.chat("Hello there!");
    expect(res.text).toBe("Universal response");
    expect(res.provider).toBe("custom-mock");
  });

  it("should stream chunks effortlessly", async () => {
    const mock = new MockProvider("stream-mock", {
      chunksToStream: ["Vision", " ", "Universal", " ", "AI"]
    });
    const ai = new VisionAI({
      provider: "stream-mock",
      providers: [mock]
    });

    const stream = await ai.stream("Stream prompt");
    const chunks: string[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk.delta);
    }

    expect(chunks.join("")).toBe("Vision Universal AI");
    expect(await stream.getText()).toBe("Vision Universal AI");
  });

  it("should support middleware pipeline hooks", async () => {
    const mock = new MockProvider("mw-mock", { responseText: "Original text" });
    const ai = new VisionAI({
      provider: "mw-mock",
      providers: [mock]
    });

    const onRequest = vi.fn();
    const onResponse = vi.fn();

    ai.use({
      onRequest(options) {
        onRequest(options);
      },
      onResponse(res) {
        onResponse(res);
        return {
          ...res,
          text: res.text + " [MODIFIED_BY_MIDDLEWARE]"
        };
      }
    });

    const res = await ai.chat("Testing middleware");
    expect(onRequest).toHaveBeenCalled();
    expect(onResponse).toHaveBeenCalled();
    expect(res.text).toBe("Original text [MODIFIED_BY_MIDDLEWARE]");
  });

  it("should extract structured schema outputs via ai.generate()", async () => {
    const mock = new MockProvider("json-mock", {
      responseText: '```json\n{"name": "Alpha", "score": 98}\n```'
    });
    const ai = new VisionAI({
      provider: "json-mock",
      providers: [mock]
    });

    const result = await ai.generate<{ name: string; score: number }>({
      prompt: "Generate score",
      responseFormat: {
        type: "json",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            score: { type: "number" }
          },
          required: ["name", "score"]
        }
      }
    });

    expect(result.data.name).toBe("Alpha");
    expect(result.data.score).toBe(98);
  });
});
