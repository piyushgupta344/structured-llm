# Changelog

All notable changes to this project will be documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). This project uses [semantic versioning](https://semver.org/).

---

## [0.3.1] — 2026-03-14

### Added

- Published to [JSR](https://jsr.io/@piyushgupta/structured-llm) — install via `deno add jsr:@piyushgupta/structured-llm` or `npx jsr add @piyushgupta/structured-llm`
- Automated release workflow now publishes to both npm and JSR on every version bump

---

## [0.3.0] — 2026-03-13

### Added

- **OpenAI Structured Outputs** (`json-schema` mode) — uses `response_format: { type: "json_schema", strict: true }` for guaranteed schema adherence at the API level
- `makeStrictSchema()` — deep-transforms JSON schemas to satisfy OpenAI strict mode rules: `additionalProperties: false`, all properties required, optional fields wrapped as nullable `anyOf`
- `strictJsonSchema` capability flag on `ModelCapabilities` — marks gpt-4o, gpt-4o-mini, gpt-4.1 family, o3, o3-mini, o4-mini as strict-schema-compatible
- `"json-schema"` added to `ExtractionMode` union
- `auto` mode now prefers `json-schema` over `tool-calling` for models that support it
- Non-OpenAI providers (Anthropic, Gemini, Mistral, Bedrock) transparently fall back to `tool-calling` when `mode: "json-schema"` is requested

### Fixed

- `vitest.config.ts` had a hardcoded absolute filesystem path that broke CI on any machine other than the original dev box
- `typecheck` now covers only `src/` and `integrations/` — examples and tests no longer produce false type errors
- `tsconfig.json` lib updated to ES2022 (enables `.at()` and other modern array methods)
- Circular type annotation in `src/hooks.ts`
- Syntax errors (semicolons instead of commas) in three example files
- All CI workflows updated to `pnpm/action-setup@v4`
- CI branch target corrected from `main` to `master`

---

## [0.2.1] — 2026-02-XX

### Added

- AWS Bedrock provider adapter (Converse API, tool-calling + streaming)
- Standard Schema support — use any Standard Schema-compliant validator (Valibot, ArkType, Effect Schema, etc.)
- `generateArrayStream()` — stream an array of typed items with partial updates
- `AbortSignal` support on `generate()`, `generateStream()`, `generateArray()`
- `topP` and `seed` sampling parameters
- `onChunk` hook for streaming partial updates
- Rate-limit retry — automatically retries 429 responses with exponential backoff
- New models: gpt-4.1 family, o3, o4-mini, claude-sonnet-4-6, gemini-2.5-pro, Llama 4, DeepSeek R2

### Fixed

- Framework integrations (Next.js, Hono, Express) documentation and type exports

---

## [0.2.0] — 2026-01-XX

### Added

- `generateBatch()` — process many inputs concurrently with progress tracking and per-item error handling
- `generateMultiSchema()` — extract multiple schemas from the same prompt in one call
- `withCache()` — plug-in caching layer with TTL and custom cache stores
- `createTemplate()` — reusable prompt templates with typed variable interpolation
- `classify()` — convenience wrapper for enum/label classification
- `extract()` — convenience wrapper for simple field extraction

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
