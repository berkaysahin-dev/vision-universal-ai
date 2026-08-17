import { VisionAI } from "vision-universal-ai";

async function main() {
  console.log("=== Vision Universal AI - Quickstart Chat ===\n");

  // 1. Initialize with Google Gemini
  const geminiAI = new VisionAI({
    provider: "gemini",
    apiKey: process.env.GEMINI_API_KEY
  });

  console.log("-> Querying Google Gemini...");
  const geminiResponse = await geminiAI.chat("Explain quantum computing in one short sentence.");
  console.log(`[Gemini] ${geminiResponse.text}\n`);

  // 2. Switch provider to OpenAI with the exact same API
  const openAI = new VisionAI({
    provider: "openai",
    apiKey: process.env.OPENAI_API_KEY
  });

  console.log("-> Querying OpenAI...");
  const openAIResponse = await openAI.chat("Explain quantum computing in one short sentence.");
  console.log(`[OpenAI] ${openAIResponse.text}\n`);

  // 3. Switch provider to Anthropic Claude with the exact same API
  const claudeAI = new VisionAI({
    provider: "anthropic",
    apiKey: process.env.ANTHROPIC_API_KEY
  });

  console.log("-> Querying Anthropic Claude...");
  const claudeResponse = await claudeAI.chat("Explain quantum computing in one short sentence.");
  console.log(`[Claude] ${claudeResponse.text}\n`);

  // Inspect usage information normalized across all providers
  console.log("Tokens consumed (Gemini):", geminiResponse.usage);
  console.log("Tokens consumed (OpenAI):", openAIResponse.usage);
}

main().catch(console.error);
