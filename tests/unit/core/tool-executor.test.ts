import { describe, it, expect, vi } from "vitest";
import { executeSingleTool, runToolLoop } from "@vision-ai/core";
import { MockProvider } from "../../fixtures/mock-provider.js";
import type { AITool } from "@vision-ai/core";

describe("Tool Execution System", () => {
  it("should execute a registered single tool successfully", async () => {
    const calcTool: AITool<{ a: number; b: number }, number> = {
      name: "add",
      description: "Adds two numbers",
      execute: async ({ a, b }) => a + b
    };

    const res = await executeSingleTool(
      {
        id: "call_123",
        name: "add",
        arguments: { a: 10, b: 25 }
      },
      [calcTool]
    );

    expect(res.name).toBe("add");
    expect(res.result).toBe(35);
    expect(res.error).toBeUndefined();
  });

  it("should handle tool execution exceptions gracefully", async () => {
    const failingTool: AITool = {
      name: "crash",
      description: "A tool that throws",
      execute: async () => {
        throw new Error("Database connection lost");
      }
    };

    const res = await executeSingleTool(
      {
        id: "call_fail",
        name: "crash",
        arguments: {}
      },
      [failingTool]
    );

    expect(res.error).toContain("Database connection lost");
    expect(res.result).toBeNull();
  });

  it("should orchestrate multi-step autonomous tool execution loop", async () => {
    const toolMock = vi.fn().mockResolvedValue({ weather: "Sunny in Paris", temp: 22 });
    const weatherTool: AITool = {
      name: "get_weather",
      description: "Get weather",
      execute: toolMock
    };

    let callIndex = 0;
    const provider = new MockProvider("mock-tool-provider");
    provider.chat = vi.fn().mockImplementation(async () => {
      callIndex++;
      if (callIndex === 1) {
        return {
          text: "",
          toolCalls: [{ id: "call_t1", name: "get_weather", arguments: { city: "Paris" } }],
          provider: "mock-tool-provider",
          model: "mock-model"
        };
      }
      return {
        text: "The weather in Paris is Sunny and 22C.",
        finishReason: "stop",
        provider: "mock-tool-provider",
        model: "mock-model"
      };
    });

    const response = await runToolLoop(provider, {
      prompt: "How is the weather in Paris?",
      tools: [weatherTool]
    });

    expect(toolMock).toHaveBeenCalledWith({ city: "Paris" });
    expect(response.text).toBe("The weather in Paris is Sunny and 22C.");
    expect(provider.chat).toHaveBeenCalledTimes(2);
  });
});
