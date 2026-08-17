import { describe, it, expect, vi } from "vitest";
import { GeminiProvider } from "@vision-ai/gemini";
import { OpenAIProvider } from "@vision-ai/openai";
import { AnthropicProvider } from "@vision-ai/anthropic";
import { DeepSeekProvider } from "@vision-ai/deepseek";
import { OllamaProvider } from "@vision-ai/ollama";

describe("Provider Adapters Integration & Protocol Compliance", () => {
  it("GeminiProvider formats generateContent payload and parses response", async () => {
    let capturedUrl = "";
    let capturedBody: { contents?: Array<{ parts?: Array<{ text?: string }> }>; generationConfig?: { temperature?: number } } = {};

    const mockFetch = vi.fn().mockImplementation(async (url: string, init: { body: string }) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: "Gemini response text" }]
              },
              finishReason: "STOP"
            }
          ],
          usageMetadata: {
            promptTokenCount: 12,
            candidatesTokenCount: 8,
            totalTokenCount: 20
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const gemini = new GeminiProvider({
      apiKey: "test-gemini-key",
      fetch: mockFetch
    });

    const res = await gemini.chat({
      prompt: "Hello Gemini",
      model: "gemini-2.0-flash",
      temperature: 0.7
    });

    expect(capturedUrl).toContain("models/gemini-2.0-flash:generateContent?key=test-gemini-key");
    expect(capturedBody.contents?.[0]?.parts?.[0]?.text).toBe("Hello Gemini");
    expect(capturedBody.generationConfig?.temperature).toBe(0.7);
    expect(res.text).toBe("Gemini response text");
    expect(res.finishReason).toBe("stop");
    expect(res.usage?.totalTokens).toBe(20);
  });

  it("OpenAIProvider formats chat/completions payload and parses response", async () => {
    let capturedBody: { model?: string; messages?: Array<{ content?: string }> } = {};

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: { body: string }) => {
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          id: "chatcmpl-123",
          model: "gpt-4o",
          choices: [
            {
              message: { role: "assistant", content: "OpenAI response text" },
              finish_reason: "stop"
            }
          ],
          usage: { prompt_tokens: 15, completion_tokens: 25, total_tokens: 40 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const openai = new OpenAIProvider({
      apiKey: "test-openai-key",
      fetch: mockFetch
    });

    const res = await openai.chat({
      prompt: "Hello GPT",
      model: "gpt-4o"
    });

    expect(capturedBody.model).toBe("gpt-4o");
    expect(capturedBody.messages?.[0]?.content).toBe("Hello GPT");
    expect(res.text).toBe("OpenAI response text");
    expect(res.usage?.totalTokens).toBe(40);
  });

  it("AnthropicProvider formats /messages payload and parses response", async () => {
    let capturedHeaders: Record<string, string> = {};
    let capturedBody: { system?: string; messages?: Array<{ content?: Array<{ text?: string }> }> } = {};

    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: { headers: Record<string, string>; body: string }) => {
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({
          id: "msg_123",
          type: "message",
          role: "assistant",
          content: [{ type: "text", text: "Claude response text" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 18, output_tokens: 32 }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const anthropic = new AnthropicProvider({
      apiKey: "test-anthropic-key",
      fetch: mockFetch
    });

    const res = await anthropic.chat({
      systemInstruction: "You are a helpful assistant.",
      prompt: "Hello Claude",
      model: "claude-3-5-sonnet-20241022"
    });

    expect(capturedHeaders["x-api-key"]).toBe("test-anthropic-key");
    expect(capturedBody.system).toBe("You are a helpful assistant.");
    expect(res.text).toBe("Claude response text");
    expect(res.finishReason).toBe("stop");
    expect(res.usage?.totalTokens).toBe(50);
  });

  it("DeepSeekProvider captures reasoning_content for R1 models", async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: "assistant",
                content: "Final answer after thinking",
                reasoning_content: "Thought process step 1, step 2..."
              },
              finish_reason: "stop"
            }
          ],
          usage: {
            prompt_tokens: 20,
            completion_tokens: 80,
            total_tokens: 100,
            completion_tokens_details: { reasoning_tokens: 60 }
          }
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const deepseek = new DeepSeekProvider({
      apiKey: "test-deepseek-key",
      fetch: mockFetch
    });

    const res = await deepseek.chat({
      prompt: "Solve complex math problem",
      model: "deepseek-reasoner"
    });

    expect(res.text).toBe("Final answer after thinking");
    expect(res.reasoningContent).toBe("Thought process step 1, step 2...");
    expect(res.usage?.reasoningTokens).toBe(60);
  });

  it("OllamaProvider connects to local endpoint and parses response", async () => {
    let capturedUrl = "";
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(
        JSON.stringify({
          model: "llama3.2",
          message: { role: "assistant", content: "Hello from local Ollama" },
          done: true,
          prompt_eval_count: 5,
          eval_count: 10
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const ollama = new OllamaProvider({
      baseUrl: "http://127.0.0.1:11434",
      fetch: mockFetch
    });

    const res = await ollama.chat({
      prompt: "Hello local model"
    });

    expect(capturedUrl).toBe("http://127.0.0.1:11434/api/chat");
    expect(res.text).toBe("Hello from local Ollama");
    expect(res.usage?.totalTokens).toBe(15);
  });
});
