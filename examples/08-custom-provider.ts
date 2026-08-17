import {
  VisionAI,
  type AIProvider,
  type ProviderCapabilities,
  type ChatOptions,
  type AIResponse,
  type AIChunk
} from "vision-universal-ai";

/**
 * Custom bespoke AI Provider implementation (e.g. your private internal company LLM)
 */
class MyInternalAIProvider implements AIProvider {
  public readonly name = "internal-llm";
  public readonly displayName = "Internal Enterprise AI";
  public readonly defaultModel = "enterprise-v1";
  public readonly capabilities: ProviderCapabilities = {
    chat: true,
    stream: true,
    tools: false,
    vision: false,
    audioInput: false,
    pdfInput: false,
    jsonSchema: true,
    embeddings: false,
    imageGeneration: false,
    speechToText: false,
    textToSpeech: false
  };

  async chat(options: ChatOptions): Promise<AIResponse> {
    const prompt = typeof options.messages?.[0]?.content === "string"
      ? options.messages[0].content
      : options.prompt || "Hello";

    return {
      text: `[Internal LLM Response]: Processed '${prompt}' securely on internal enterprise cluster.`,
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 15, totalTokens: 25 },
      provider: this.name,
      model: this.defaultModel
    };
  }

  async *stream(options: ChatOptions): AsyncIterable<AIChunk> {
    const words = ["Enterprise", "AI", "streaming", "from", "custom", "provider!"];
    let accumulated = "";
    for (const word of words) {
      accumulated += (accumulated ? " " : "") + word;
      yield {
        text: accumulated,
        delta: word + " ",
        finishReason: "stop"
      };
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

async function main() {
  console.log("=== Vision Universal AI - Custom Provider Plug-and-Play ===\n");

  const ai = new VisionAI();

  // Register custom provider
  ai.register(new MyInternalAIProvider());

  // Use the custom provider through the standard universal API
  const response = await ai.chat({
    prompt: "Hello custom LLM!"
  });

  console.log("Response:", response.text);
  console.log("Provider:", response.provider);

  console.log("\nStreaming test from custom provider:");
  const stream = await ai.stream("Stream test");
  for await (const chunk of stream) {
    process.stdout.write(chunk.delta);
  }
  console.log("\n");
}

main().catch(console.error);
