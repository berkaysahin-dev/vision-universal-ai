# Contributing to Vision Universal AI

Thank you for your interest in contributing to **Vision Universal AI**! We appreciate all forms of contribution: adding providers, improving performance, writing documentation, fixing bugs, and submitting issues.

---

## 🛠️ Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vision-universal-ai/vision-universal-ai.git
   cd vision-universal-ai
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Build the packages**:
   ```bash
   npm run build
   ```

4. **Run test suite**:
   ```bash
   npm test
   ```

---

## 🧩 Adding a New Provider

To contribute a new AI provider adapter (e.g. `@vision-ai/cohere` or `@vision-ai/replicate`):

1. Create a new directory under `packages/<provider-name>`
2. Implement the `AIProvider` interface from `@vision-ai/core`
3. Export a standard creator function `create<ProviderName>(...)`
4. Add unit and integration tests with deterministic mocks under `tests/`
5. Re-export the provider in `packages/sdk`
6. Update documentation and README provider matrix

---

## 🧪 Testing Guidelines

- All new features must include unit tests.
- Never hardcode live API keys in tests — use `MockProvider` or mock `fetch` responses.
- Ensure all tests pass with `npm test` before creating a pull request.

---

## 📜 Pull Request Process

1. Fork the repo and create your branch from `main`.
2. Follow the existing TypeScript and ESLint code style.
3. Write clear commit messages.
4. Update relevant documentation.
5. Open a Pull Request referencing any related issues.
