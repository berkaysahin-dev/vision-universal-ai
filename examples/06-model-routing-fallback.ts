import { VisionAI } from "vision-universal-ai";

async function main() {
  console.log("=== Vision Universal AI - Model Routing & Resilient Failover ===\n");

  // Configure high-availability routing matrix
  const ai = new VisionAI({
    routing: {
      default: "gemini",
      fallback: ["openai", "anthropic", "groq"],
      fallbackOnRateLimit: true,
      fallbackOnServerError: true,
      fallbackOnTimeout: true,
      onFallback: ({ failedProvider, error, nextProvider, attempt }) => {
        console.warn(
          `[Routing Failover Alert] Attempt ${attempt}: Provider '${failedProvider}' failed with error: "${error.message}". Automatically switching to '${nextProvider}'...`
        );
      }
    }
  });

  console.log("Executing resilient AI request with automatic failover protection...");
  const response = await ai.chat("Summarize the significance of the transformer architecture.");

  console.log(`\nSuccessfully handled by provider: [${response.provider.toUpperCase()}]`);
  console.log(`Model used: ${response.model}`);
  console.log(`Output: ${response.text.slice(0, 150)}...`);
}

main().catch(console.error);
