import { VisionAI } from "vision-universal-ai";

async function main() {
  console.log("=== Vision Universal AI - Streaming Response ===\n");

  const ai = new VisionAI({
    provider: "gemini",
    apiKey: process.env.GEMINI_API_KEY
  });

  process.stdout.write("Streaming response: ");

  const stream = await ai.stream("Write a short haiku about artificial intelligence.");

  // Iterate over incoming chunks in real-time
  for await (const chunk of stream) {
    process.stdout.write(chunk.delta);
  }

  console.log("\n\nStream completed!");

  // Convert to full text or final response if needed
  const final = await stream.getFinalResponse();
  console.log("Total tokens:", final.usage?.totalTokens);
}

main().catch(console.error);
