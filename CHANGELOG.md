# Changelog

All notable changes to **Vision Universal AI** are documented in this file.

## [1.0.0] - 2026-08-17

### Added
- **Core Architecture**: `@vision-ai/core` package with normalized types, error hierarchy, pipeline, retry with exponential backoff, timeout signals, and rate limiting.
- **Unified Client**: `VisionAI` client class supporting `ai.chat()`, `ai.stream()`, `ai.generate()`, `ai.embed()`, `ai.generateImage()`, `ai.transcribe()`, `ai.speak()`.
- **8 Production Provider Adaptors**:
  - Google Gemini (`@vision-ai/gemini`) with Gemini 2.0 Flash / Pro, multimodal, and schemas.
  - OpenAI (`@vision-ai/openai`) with GPT-4o, o3-mini, Embeddings, and DALL-E.
  - Anthropic Claude (`@vision-ai/anthropic`) with Messages API, tools, and vision.
  - Groq (`@vision-ai/groq`) with ultra-fast Llama 3.3.
  - DeepSeek (`@vision-ai/deepseek`) with V3 and R1 reasoning token extraction.
  - OpenRouter (`@vision-ai/openrouter`) with 100+ model gateways.
  - Ollama (`@vision-ai/ollama`) for local models without API keys.
  - Mistral AI (`@vision-ai/mistral`) with Mistral Large and Codestral.
- **Autonomous Multi-Step Tool Calling**: Automatic execution loop that invokes functions and returns final answers.
- **Structured Outputs**: JSON Schema validation with automatic markdown code fence extraction.
- **Resilient Model Routing**: Automatic failover chains on rate limits (429) or server errors (5xx).
- **Interactive CLI**: `vision-ai` CLI with `init`, `chat`, `test`, `models`.
- **Examples & Test Suite**: 8 full runnable TypeScript examples and comprehensive 100% deterministic test coverage.
