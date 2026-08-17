<div align="center">

# 🌌 Vision Universal AI

### **One SDK. Every AI.**

*A unified, production-grade, open-source Universal AI SDK for TypeScript and JavaScript.*

[![npm version](https://img.shields.io/npm/v/vision-universal-ai.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/vision-universal-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node: 18+](https://img.shields.io/badge/Node.js-18%2B%20%7C%20Edge%20%7C%20Bun%20%7C%20Deno-brightgreen?style=flat-square)](https://nodejs.org)
[![Tests: 31/31 Passed](https://img.shields.io/badge/Tests-31%2F31%20Passing-success.svg?style=flat-square)](https://github.com/berkaysahin-dev/vision-universal-ai)
[![Zero Dependencies](https://img.shields.io/badge/Runtime%20Deps-Zero-orange?style=flat-square)](https://github.com/berkaysahin-dev/vision-universal-ai)

[Features](#-features) • [Supported Providers](#-supported-providers) • [Quick Start](#-quick-start) • [Streaming](#-real-time-streaming) • [Tool Calling](#️-autonomous-multi-step-tool-calling) • [Structured Output](#-strict-structured-output-json-schema) • [Model Routing](#-model-routing--zero-downtime-fallback) • [CLI](#-interactive-cli) • [Documentation](#-configuration--options)

---

</div>

## 📖 Overview

**Vision Universal AI** is an enterprise-grade Universal AI SDK designed to eliminate vendor lock-in across the AI ecosystem. It provides a single, strictly typed, robust API that unifies **Google Gemini, OpenAI, Anthropic Claude, Groq, DeepSeek, OpenRouter, Ollama, and Mistral AI**.

Switching from Gemini to OpenAI or Claude requires changing only a single configuration parameter. Your tools, streaming pipelines, JSON schema extractions, and application logic remain **100% identical**.

```
                    ┌───────────────────────────────┐
                    │      Your Application         │
                    └──────────────┬────────────────┘
                                   │
                   import { VisionAI } from "vision-universal-ai"
                                   │
                    ┌──────────────▼────────────────┐
                    │    Vision Universal AI SDK    │
                    │   Pipeline • Retry • Router   │
                    └──────┬───┬───┬───┬───┬───┬───┬┘
                           │   │   │   │   │   │   │
        ┌──────────────────┼───┼───┼───┼───┼───┼───┼──────────────────┐
        │                  │   │   │   │   │   │   │                  │
  ┌─────▼─────┐      ┌─────▼───▼┐ ┌▼───▼─────┐ ┌───▼───────┐      ┌─────▼─────┐
  │  Gemini   │      │  OpenAI  │ │Anthropic │ │ DeepSeek  │      │  Ollama   │
  │2.0 / Flash│      │GPT-4o/o3 │ │Claude 3.5│ │ V3 / R1   │      │  (Local)  │
  └───────────┘      └──────────┘ └──────────┘ └───────────┘      └───────────┘
```

---

## ✨ Features

- 🔄 **Universal Provider Architecture**: Instant hot-swapping between all major cloud and local LLMs.
- ⚡ **Native Streaming**: Real-time `AsyncIterable<AIChunk>` and Web-standard `ReadableStream` token delivery.
- 🛠️ **Autonomous Multi-Step Tool Calling**: Automatic recursive execution loop that runs functions, passes back results to the model, and iterates until the final response is produced.
- 📐 **Strict Structured Outputs**: JSON Schema validation with automatic extraction from markdown code fences.
- 👁️ **Multimodal**: Native support for text, images (URLs & Base64), audio, and documents across supported models.
- 🛡️ **Zero-Downtime Model Routing**: High-availability provider matrix with automatic failover on 429 rate limits or 5xx server errors.
- 🧠 **Reasoning Tokens**: Direct capture of chain-of-thought tokens for DeepSeek-R1, OpenAI o1/o3-mini, and Gemini Thinking models into `response.reasoningContent`.
- ⏱️ **Production Resilience**: Exponential backoff retries with full jitter, per-request timeouts, and request cancellation.
- 📊 **Normalized Token Usage**: Standardized `promptTokens`, `completionTokens`, and `totalTokens` tracking across all providers.
- 🪶 **Zero Runtime Overhead**: Built purely on standard `fetch` and SSE stream parsers — works on Node.js 18+, Next.js, Cloudflare Workers, Bun, Deno, and Electron.
- 💻 **Interactive CLI**: Scaffold, test, and chat from the terminal with `npx vision-ai`.

---

## 📦 Supported Providers

| Provider | Chat | Streaming | Tool Calling | Vision | Structured JSON | Embeddings | Reasoning (R1/o1) | Default Model |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Google Gemini** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `gemini-2.0-flash` |
| **OpenAI** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | `gpt-4o` |
| **Anthropic Claude** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ *(N/A)* | ❌ *(N/A)* | `claude-3-5-sonnet-20241022` |
| **Groq** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ *(N/A)* | ❌ *(N/A)* | `llama-3.3-70b-versatile` |
| **DeepSeek** | ✅ | ✅ | ✅ | ❌ *(N/A)* | ✅ | ❌ *(N/A)* | ✅ | `deepseek-chat` |
| **OpenRouter** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ *(N/A)* | ✅ | `meta-llama/llama-3.3-70b-instruct` |
| **Ollama (Local)** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ *(N/A)* | `llama3.2` |
| **Mistral AI** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ *(N/A)* | `mistral-large-latest` |

*(N/A indicates the provider does not provide that endpoint in their API. Calling an unsupported endpoint throws a clean `CapabilityNotSupportedError`.)*

---

## 📥 Installation

```bash
npm install vision-universal-ai
```

or with yarn, pnpm, or bun:

```bash
pnpm add vision-universal-ai
bun add vision-universal-ai
```

---

## ⚡ Quick Start

Get a working response in 3 lines of code:

```ts
import { VisionAI } from "vision-universal-ai";

const ai = new VisionAI({
  provider: "gemini",
  apiKey: process.env.GEMINI_API_KEY
});

const response = await ai.chat("Explain quantum entanglement in simple terms.");
console.log(response.text);
```

---

## 🔄 Provider Switching

Switching models requires changing only the `provider` name. Everything else remains identical:

```ts
// OpenAI
const ai = new VisionAI({ provider: "openai", apiKey: process.env.OPENAI_API_KEY });

// Anthropic Claude
const ai = new VisionAI({ provider: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY });

// Groq (Ultra-low latency)
const ai = new VisionAI({ provider: "groq", apiKey: process.env.GROQ_API_KEY });

// DeepSeek (V3 / R1 Reasoning)
const ai = new VisionAI({ provider: "deepseek", apiKey: process.env.DEEPSEEK_API_KEY });

// Local Ollama (No API Key required)
const ai = new VisionAI({ provider: "ollama", baseUrl: "http://localhost:11434" });

// Mistral AI
const ai = new VisionAI({ provider: "mistral", apiKey: process.env.MISTRAL_API_KEY });
```

---

## 🌊 Real-Time Streaming

Stream tokens in real-time with standard `for await...of`:

```ts
import { VisionAI } from "vision-universal-ai";

const ai = new VisionAI({ provider: "gemini" });
const stream = await ai.stream("Write a compelling short story about artificial intelligence.");

for await (const chunk of stream) {
  process.stdout.write(chunk.delta);
}

// Retrieve complete aggregated metadata when stream ends:
const finalResponse = await stream.getFinalResponse();
console.log("\nTotal tokens used:", finalResponse.usage?.totalTokens);
```

---

## 🛠️ Autonomous Multi-Step Tool Calling

Define standard JavaScript functions as tools. Vision Universal AI automatically executes tool requests and feeds results back to the model until a final answer is reached:

```ts
import { VisionAI, type AITool } from "vision-universal-ai";

const weatherTool: AITool<{ city: string }> = {
  name: "get_weather",
  description: "Get real-time weather information for a specific city.",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "City name, e.g. Tokyo" }
    },
    required: ["city"]
  },
  execute: async ({ city }) => {
    return { city, temperature: 24, condition: "Sunny with clear skies" };
  }
};

const ai = new VisionAI({ provider: "openai" });

const response = await ai.chat({
  prompt: "What is the weather in Tokyo right now?",
  tools: [weatherTool]
});

console.log(response.text);
// "The weather in Tokyo is currently sunny with clear skies and a temperature of 24°C."
```

---

## 📐 Strict Structured Output (JSON Schema)

Extract strictly typed, validated JSON structures:

```ts
import { VisionAI } from "vision-universal-ai";

interface ProductItem {
  id: string;
  name: string;
  price: number;
  tags: string[];
  inStock: boolean;
}

const ai = new VisionAI({ provider: "gemini" });

const result = await ai.generate<ProductItem>({
  prompt: "Generate a high-performance quantum workstation spec.",
  responseFormat: {
    type: "json",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        price: { type: "number" },
        tags: { type: "array", items: { type: "string" } },
        inStock: { type: "boolean" }
      },
      required: ["id", "name", "price", "tags", "inStock"]
    }
  }
});

console.log(result.data.name);    // Type-safe string
console.log(result.data.price);   // Type-safe number
console.log(result.data.inStock); // Type-safe boolean
```

---

## 🛡️ Model Routing & Zero-Downtime Fallback

Protect your production apps against 429 Rate Limits and 5xx server downtime with resilient failover chains:

```ts
import { VisionAI } from "vision-universal-ai";

const ai = new VisionAI({
  routing: {
    default: "gemini",
    fallback: ["openai", "anthropic", "groq"],
    fallbackOnRateLimit: true,
    fallbackOnServerError: true,
    onFallback: ({ failedProvider, error, nextProvider, attempt }) => {
      console.warn(`[Failover] ${failedProvider} failed (${error.message}). Failing over to ${nextProvider}...`);
    }
  }
});

// If Google Gemini hits a rate limit or 503 outage,
// the SDK automatically routes to OpenAI, then Claude, without unhandled exceptions.
const response = await ai.chat("Process mission-critical analytics.");
```

---

## 🧠 Reasoning Tokens (DeepSeek-R1, o1, o3-mini)

Access raw chain-of-thought reasoning tokens:

```ts
const ai = new VisionAI({ provider: "deepseek", defaultModel: "deepseek-reasoner" });
const response = await ai.chat("Solve this complex logical puzzle.");

console.log("=== THOUGHT PROCESS ===");
console.log(response.reasoningContent);

console.log("\n=== FINAL ANSWER ===");
console.log(response.text);
```

---

## 👁️ Multimodal (Vision & Files)

Analyze images from remote URLs or inline Base64 buffers:

```ts
const response = await ai.chat({
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "Describe what is depicted in this photo." },
        { type: "image", image: "https://example.com/satellite.jpg" }
      ]
    }
  ]
});
```

---

## 🚨 Error Handling

All SDK errors inherit from `VisionAIError` with normalized HTTP status codes and provider context:

```ts
import {
  VisionAI,
  VisionAIError,
  AuthenticationError,
  RateLimitError,
  TimeoutError,
  CapabilityNotSupportedError
} from "vision-universal-ai";

try {
  const response = await ai.chat("...");
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error(`Rate limit exceeded on provider: ${error.provider}`);
  } else if (error instanceof AuthenticationError) {
    console.error(`Invalid API key on provider: ${error.provider}`);
  } else if (error instanceof CapabilityNotSupportedError) {
    console.error(`Feature unsupported: ${error.message}`);
  } else if (error instanceof VisionAIError) {
    console.error(`[${error.provider}] Status ${error.statusCode}: ${error.message}`);
  }
}
```

---

## ⚙️ Configuration & Options

```ts
const ai = new VisionAI({
  provider: "gemini",              // Active default provider
  apiKey: process.env.API_KEY,     // Explicit API Key (or reads from env)
  baseUrl: "https://custom-proxy", // Custom proxy endpoint
  defaultModel: "gemini-2.0-flash",// Model override
  timeoutMs: 30000,                // Request timeout in ms (default: 60000ms)
  maxRetries: 3                    // Exponential backoff retries (default: 3)
});
```

---

## 🔌 Custom Providers

Add any bespoke internal enterprise LLM in ~20 lines:

```ts
import { VisionAI, type AIProvider } from "vision-universal-ai";

class MyEnterpriseLLM implements AIProvider {
  public readonly name = "enterprise-ai";
  public readonly displayName = "Enterprise AI";
  public readonly defaultModel = "v1";
  public readonly capabilities = {
    chat: true, stream: true, tools: false, vision: false,
    audioInput: false, pdfInput: false, jsonSchema: true,
    embeddings: false, imageGeneration: false, speechToText: false, textToSpeech: false
  };

  async chat(options) {
    const res = await fetch("https://internal-llm.corp.local/v1/chat", { ... });
    return { text: "...", provider: this.name, model: this.defaultModel };
  }

  async *stream(options) {
    // yield AIChunk objects
  }
}

const ai = new VisionAI();
ai.register(new MyEnterpriseLLM());
```

---

## 💻 Interactive CLI

Vision Universal AI comes with a built-in terminal CLI:

```bash
# Scaffold a new configuration file & .env template
npx vision-ai init

# Start an interactive streaming chat session in the terminal
npx vision-ai chat gemini

# Diagnose & test connectivity of all configured provider keys
npx vision-ai test

# List model profiles & provider key status
npx vision-ai models
```

---

## 🧪 Testing

Vision Universal AI includes a 100% deterministic test suite:

```bash
# Run unit & integration test suites
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## 🛣️ Roadmap

- [x] Universal Core Engine (Retry, Routing, Tools, Streaming, Normalization)
- [x] 8 Production Adaptors (Gemini, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter, Ollama, Mistral)
- [x] Strict TypeScript definitions and ESM/CJS dual builds
- [x] Full unit and integration test coverage (31/31 passed)
- [ ] Cohere & Perplexity provider adapters
- [ ] Next.js AI SDK React Server Component stream compatibility adaptor
- [ ] Vector Database connectors (Pinecone, Qdrant, Chroma)

---

## 🤝 Contributing

We welcome community contributions! Please review [CONTRIBUTING.md](./CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before submitting a pull request.

---

## 📄 License

Vision Universal AI is open-source software licensed under the [MIT License](./LICENSE).

---

<div align="center">

**[Shaz Vision](https://shazvision.com)** • *Building the Intelligent Future*

</div>
