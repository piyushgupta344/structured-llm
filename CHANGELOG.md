# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project uses [semantic versioning](https://semver.org/).

---

## [0.1.0] — 2025-03-10

Initial release.

### Added

- `generate()` — extract a single typed object from any LLM
- `generateArray()` — extract a list of typed items
- `generateStream()` — streaming with partial object updates
- `createClient()` — reusable pre-configured client with default options
- **13 provider adapters**: OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, xAI, Together AI, Fireworks, Perplexity, Ollama, Azure OpenAI, AWS Bedrock
- Auto-detection of provider from client instance
- Three extraction modes: `tool-calling`, `json-mode`, `prompt-inject` with automatic selection per model
- Retry loop with error feedback — validation errors are sent back to the LLM to fix
- Fallback chain — try multiple providers/models in order
- Usage tracking with token counts and cost estimates
- Hooks system: `onRequest`, `onResponse`, `onRetry`, `onSuccess`, `onError`
- Model capability registry (35+ models) with pricing data
- Custom schema support — bring your own validator instead of Zod
- Framework integrations: Next.js App Router, Hono middleware, Express middleware
- Zod v3 and v4 support
- Zero runtime dependencies (Zod is a peer dep)
- 120 unit tests, all running offline with mock clients
- 10 runnable examples
