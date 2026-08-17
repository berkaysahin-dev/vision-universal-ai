import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "packages/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"]
    }
  },
  resolve: {
    alias: {
      "@vision-ai/core": path.resolve(__dirname, "packages/core/src"),
      "@vision-ai/openai": path.resolve(__dirname, "packages/openai/src"),
      "@vision-ai/gemini": path.resolve(__dirname, "packages/gemini/src"),
      "@vision-ai/anthropic": path.resolve(__dirname, "packages/anthropic/src"),
      "@vision-ai/groq": path.resolve(__dirname, "packages/groq/src"),
      "@vision-ai/deepseek": path.resolve(__dirname, "packages/deepseek/src"),
      "@vision-ai/openrouter": path.resolve(__dirname, "packages/openrouter/src"),
      "@vision-ai/ollama": path.resolve(__dirname, "packages/ollama/src"),
      "@vision-ai/mistral": path.resolve(__dirname, "packages/mistral/src"),
      "vision-universal-ai": path.resolve(__dirname, "packages/sdk/src")
    }
  }
});
