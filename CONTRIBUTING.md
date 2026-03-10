# Contributing

Thanks for your interest in contributing. This document covers everything you need to get started.

## What we're looking for

**High-value contributions:**
- New provider adapters (see below for how)
- Bugs with a reproduction case
- Documentation improvements and typo fixes
- New examples for real-world use cases
- Performance improvements with benchmarks

**Out of scope (for now):**
- Breaking changes to the public API without a discussion issue first
- Large new features without prior discussion — open an issue first

---

## Setup

```bash
git clone https://github.com/piyushgupta344/structured-llm
cd structured-llm
pnpm install
```

Make sure tests pass before making any changes:

```bash
pnpm test
```

The test suite runs entirely offline (no API keys needed) — all provider calls are mocked.

---

## Project structure

```
src/
  generate.ts            # core orchestrator — start here to understand the flow
  generate-array.ts      # array extraction wrapper
  generate-stream.ts     # streaming implementation
  client.ts              # createClient() factory
  retry.ts               # retry loop, JSON extraction, error messages
  hooks.ts               # hook runner
  models.ts              # model capability registry + cost table
  usage.ts               # token counting + cost calculation
  errors.ts              # error classes
  types.ts               # all public types
  providers/
    types.ts             # ProviderAdapter interface
    registry.ts          # auto-detect client → adapter
    openai.ts            # OpenAI (+ base for compat providers)
    anthropic.ts
    gemini.ts
    mistral.ts
    cohere.ts
    compat/base.ts       # base for OpenAI-compatible providers
  schema/
    detect.ts            # resolve schema → SchemaAdapter
    adapters/zod.ts      # Zod v3/v4 → SchemaAdapter

integrations/
  next/index.ts
  hono/index.ts
  express/index.ts

tests/
  fixtures/mock-clients.ts   # typed mock clients for all providers
  unit/                      # unit tests (no API keys needed)

examples/                    # runnable examples (need API keys)
```

---

## Adding a new provider

This is the most common contribution. Here's exactly what to do.

### 1. Create the adapter

Create `src/providers/yourprovider.ts`:

```typescript
import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";
import { ProviderError } from "../errors.js";

export class YourProviderAdapter implements ProviderAdapter {
  readonly name = "yourprovider" as const;
  private client: any;

  constructor(client: any) {
    this.client = client;
  }

  async complete(req: AdapterRequest): Promise<AdapterResponse> {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;

    try {
      if (mode === "tool-calling") {
        // implement tool calling
      }

      if (mode === "json-mode") {
        // implement json mode if supported
      }

      // prompt-inject fallback
      // ...
    } catch (err) {
      const e = err as any;
      throw new ProviderError("yourprovider", e?.message ?? String(err), e?.status, err);
    }
  }

  // optional — only if provider supports streaming
  async *stream(req: AdapterRequest): AsyncIterable<string> {
    // yield string chunks
  }
}

export function isYourProviderClient(client: any): boolean {
  return client?.constructor?.name === "YourProviderSDKClass";
}
```

Look at `src/providers/anthropic.ts` or `src/providers/mistral.ts` for complete examples.

If the provider is OpenAI-compatible (uses the same API format), you don't need a new adapter — just add it to `registry.ts` with the right `baseURL` pattern. Look at how Groq and xAI are handled there.

### 2. Register it

In `src/providers/registry.ts`:

```typescript
// Add to the imports
import { YourProviderAdapter, isYourProviderClient } from "./yourprovider.js";

// Add to adapterFromClient()
if (isYourProviderClient(client)) return new YourProviderAdapter(client);

// Add to adapterFromProvider()
case "yourprovider": {
  const { YourProviderSDK } = await import("yourprovider-sdk");
  return new YourProviderAdapter(new YourProviderSDK({ apiKey: key }));
}
```

### 3. Add to types

In `src/types.ts`, add to the `ProviderName` union:

```typescript
export type ProviderName =
  | "openai"
  | "anthropic"
  | "yourprovider"    // add here
  | ...
```

### 4. Register env key

In `registry.ts`, add to `getEnvKey()`:

```typescript
const envMap: Record<ProviderName, string> = {
  yourprovider: "YOUR_PROVIDER_API_KEY",
  ...
}
```

### 5. Add models (optional but appreciated)

In `src/models.ts`, add the provider's models to the registry with their capabilities and pricing.

### 6. Add a mock client

In `tests/fixtures/mock-clients.ts`, add a mock for your provider (see the existing ones for reference).

### 7. Add tests

Add `tests/unit/providers/yourprovider.test.ts` and test detection + extraction in both tool-calling and json-mode.

### 8. Update README

Add the provider to the providers table and show an example of how to create the client.

---

## Running tests

```bash
pnpm test              # run all tests
pnpm test:watch        # watch mode
pnpm test:coverage     # with coverage report
pnpm typecheck         # TypeScript without building
```

All tests use mock clients — no real API calls, no API keys needed.

If you want to test against a real API (optional), create a `.env` file:

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

Then run examples directly:

```bash
npx tsx examples/01-sentiment-analysis.ts
```

---

## Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add Cohere provider adapter
fix: handle empty tool call arguments in OpenAI adapter
docs: add Ollama example to README
test: add coverage for retry with exponential backoff
chore: update model pricing table
```

---

## Pull request checklist

Before opening a PR, make sure:

- [ ] `pnpm test` passes with no failures
- [ ] `pnpm typecheck` has no errors
- [ ] New code has corresponding tests
- [ ] If adding a provider: mock client + tests + README entry
- [ ] If adding a feature: at least one example or test demonstrating it
- [ ] Commit messages follow conventional commits

---

## Versioning

We use [changesets](https://github.com/changesets/changesets). When your PR is ready:

```bash
pnpm changeset
```

Pick the appropriate bump type (patch/minor/major) and write a brief description of the change. Commit the generated changeset file along with your changes.

---

## Questions

Open a [GitHub Discussion](https://github.com/piyushgupta344/structured-llm/discussions) for anything that isn't a bug or feature request.
