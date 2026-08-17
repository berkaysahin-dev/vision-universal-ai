import * as readline from "node:readline";
import * as fs from "node:fs";
import * as path from "node:path";
import { VisionAI } from "vision-universal-ai";

export async function runCLI(args: string[]) {
  const command = args[0] || "help";

  switch (command) {
    case "init":
      await handleInit();
      break;
    case "chat":
      await handleChat(args.slice(1));
      break;
    case "models":
      await handleModels();
      break;
    case "test":
      await handleTest();
      break;
    case "version":
    case "-v":
    case "--version":
      console.log("Vision Universal AI CLI v1.0.0");
      break;
    case "help":
    case "--help":
    case "-h":
    default:
      printHelp();
      break;
  }
}

function printHelp() {
  console.log(`
┌──────────────────────────────────────────────────┐
│  VISION UNIVERSAL AI - CLI                       │
│  "One SDK. Every AI."                            │
└──────────────────────────────────────────────────┘

Usage:
  vision-ai <command> [options]

Commands:
  init             Scaffold a new Vision AI project configuration
  chat [provider]  Start an interactive terminal chat with streaming
  models           List available providers and model configurations
  test             Run diagnostics to check provider API key validity
  version          Print CLI version
  help             Show this help message

Examples:
  npx vision-ai init
  npx vision-ai chat gemini
  npx vision-ai chat openai
  npx vision-ai test
`);
}

async function handleInit() {
  const targetEnv = path.resolve(process.cwd(), ".env.example");
  const envContent = `# Vision Universal AI - Environment Configuration
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GROQ_API_KEY=your_groq_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OPENROUTER_API_KEY=your_openrouter_api_key_here
MISTRAL_API_KEY=your_mistral_api_key_here
OLLAMA_HOST=http://localhost:11434
`;

  const configPath = path.resolve(process.cwd(), "vision.config.json");
  const configContent = JSON.stringify(
    {
      $schema: "https://vision-ai.dev/schema.json",
      defaultProvider: "gemini",
      routing: {
        default: "gemini",
        fallback: ["openai", "anthropic", "groq"],
        fallbackOnRateLimit: true,
        fallbackOnServerError: true
      },
      timeoutMs: 60000,
      retries: 3
    },
    null,
    2
  );

  fs.writeFileSync(targetEnv, envContent, "utf-8");
  fs.writeFileSync(configPath, configContent, "utf-8");

  console.log("Initialized Vision Universal AI project files:");
  console.log(`  Created: ${targetEnv}`);
  console.log(`  Created: ${configPath}`);
  console.log("\nNext step: Copy .env.example to .env and add your API keys.");
}

async function handleModels() {
  console.log(`
Configured Providers:
  1. Google Gemini  (GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "CONFIGURED" : "MISSING"})
     - Default Model: gemini-2.0-flash
     - Capabilities: Chat, Streaming, Tools, Vision, Audio, PDF, JSON Schema, Embeddings

  2. OpenAI         (OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? "CONFIGURED" : "MISSING"})
     - Default Model: gpt-4o
     - Capabilities: Chat, Streaming, Tools, Vision, JSON Schema, Embeddings, DALL-E

  3. Anthropic      (ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "CONFIGURED" : "MISSING"})
     - Default Model: claude-3-5-sonnet-20241022
     - Capabilities: Chat, Streaming, Tools, Vision, PDF, JSON Schema

  4. Groq           (GROQ_API_KEY: ${process.env.GROQ_API_KEY ? "CONFIGURED" : "MISSING"})
     - Default Model: llama-3.3-70b-versatile
     - Capabilities: Chat, Streaming, Tools, Ultra-low Latency

  5. DeepSeek       (DEEPSEEK_API_KEY: ${process.env.DEEPSEEK_API_KEY ? "CONFIGURED" : "MISSING"})
     - Default Model: deepseek-chat
     - Capabilities: Chat, Reasoning Tokens (R1), Tools, JSON Schema

  6. OpenRouter     (OPENROUTER_API_KEY: ${process.env.OPENROUTER_API_KEY ? "CONFIGURED" : "MISSING"})
     - Default Model: meta-llama/llama-3.3-70b-instruct
     - Capabilities: Multi-model Gateway

  7. Ollama (Local) (OLLAMA_HOST: ${process.env.OLLAMA_HOST || "http://localhost:11434"})
     - Default Model: llama3.2
     - Capabilities: Local Chat, Streaming, Vision, Embeddings

  8. Mistral AI     (MISTRAL_API_KEY: ${process.env.MISTRAL_API_KEY ? "CONFIGURED" : "MISSING"})
     - Default Model: mistral-large-latest
     - Capabilities: Chat, Streaming, Tools, Embeddings
`);
}

async function handleTest() {
  console.log("Checking configured AI providers...\n");
  const providers = ["gemini", "openai", "anthropic", "groq", "deepseek", "openrouter", "ollama", "mistral"];

  for (const p of providers) {
    const ai = new VisionAI({ provider: p });
    try {
      const start = Date.now();
      const res = await ai.chat({ prompt: "Say 'OK' in one word.", maxTokens: 5, timeoutMs: 5000 });
      const elapsed = Date.now() - start;
      console.log(`[PASS] ${p.toUpperCase().padEnd(12)} - ${elapsed}ms -> "${res.text.trim()}"`);
    } catch (err: any) {
      console.log(`[FAIL] ${p.toUpperCase().padEnd(12)} - ${err.message}`);
    }
  }
}

async function handleChat(args: string[]) {
  const provider = args[0] || process.env.DEFAULT_PROVIDER || "gemini";
  console.log(`Starting Vision AI interactive chat session [Provider: ${provider}]`);
  console.log("Type your prompt and press Enter. Type 'exit' to quit.\n");

  const ai = new VisionAI({ provider });
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const promptUser = () => {
    rl.question("\nYou > ", async (userInput) => {
      const input = userInput.trim();
      if (!input || input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      process.stdout.write("\nAI  > ");
      try {
        const stream = await ai.stream(input);
        for await (const chunk of stream) {
          process.stdout.write(chunk.delta);
        }
        console.log();
      } catch (err: any) {
        console.error(`\n[Error]: ${err.message}`);
      }

      promptUser();
    });
  };

  promptUser();
}
