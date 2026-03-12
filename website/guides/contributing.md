# Contributing

Contributions are welcome. This guide covers how to set up the development environment, run tests, and submit changes.

## Prerequisites

- Node.js 18 or later
- pnpm 8 or later (`npm install -g pnpm`)

## Setup

```bash
git clone https://github.com/piyushgupta344/structured-llm
cd structured-llm
pnpm install
```

## Project structure

```
structured-llm/
├── src/                     # Core library source
│   ├── providers/           # Provider adapters (openai, anthropic, etc.)
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   ├── gemini.ts
│   │   ├── mistral.ts
│   │   ├── cohere.ts
│   │   ├── bedrock.ts
│   │   ├── registry.ts      # Provider detection and instantiation
│   │   └── types.ts         # AdapterRequest / AdapterResponse
│   ├── schema/              # Schema resolution (Zod, Standard Schema, custom)
│   │   ├── detect.ts
│   │   └── adapters/
│   ├── generate.ts          # Core generation function
│   ├── generate-array.ts
│   ├── generate-stream.ts
│   ├── generate-array-stream.ts
│   ├── generate-batch.ts
│   ├── generate-multi-schema.ts
│   ├── classify.ts
│   ├── extract.ts
│   ├── client.ts
│   ├── template.ts
│   ├── cache.ts
│   ├── models.ts            # Model capability registry
│   ├── hooks.ts
│   ├── retry.ts
│   ├── errors.ts
│   ├── types.ts
│   └── index.ts             # Public API exports
├── integrations/            # Framework integrations
│   ├── next/
│   ├── hono/
│   └── express/
├── tests/                   # Test suite
├── examples/                # Runnable examples
├── website/                 # VitePress documentation
└── tsup.config.ts           # Build config
```

## Development workflow

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Build the library
pnpm build

# Preview the docs site locally
pnpm docs:dev
```

## Running a specific test

```bash
pnpm test src/tests/generate.test.ts
```

## Running examples

Set at least one provider API key, then run any example:

```bash
export OPENAI_API_KEY=sk-...
npx tsx examples/11-resume-parsing.ts
```

## Adding a new provider

1. Create `src/providers/yourprovider.ts` implementing `ProviderAdapter`:

```typescript
import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";

export class YourProviderAdapter implements ProviderAdapter {
  readonly name = "yourprovider" as const;

  constructor(private client: YourClient) {}

  async complete(req: AdapterRequest): Promise<AdapterResponse> {
    // Call the provider API, return { text: rawJsonString }
  }

  async *stream(req: AdapterRequest): AsyncIterable<string> {
    // Yield raw text chunks as they arrive
  }
}

export function isYourProviderClient(client: unknown): boolean {
  return client instanceof YourClient;
}
```

2. Add the provider name to `ProviderName` in `src/types.ts`

3. Register it in `src/providers/registry.ts`:
   - Add to `adapterFromClient()` for auto-detection from a client instance
   - Add to `adapterFromProvider()` for creation from a provider string

4. Add model entries to `src/models.ts` with the correct capabilities

5. Add tests in `tests/providers/yourprovider.test.ts`

## Code style

- TypeScript strict mode is required — no `any` without an eslint-disable comment and justification
- No external runtime dependencies beyond what providers require (all provider SDKs are peer dependencies)
- Provider SDKs are dynamically imported to keep the base install lightweight

## Submitting changes

1. Fork the repository and create a branch: `git checkout -b feat/my-change`
2. Make changes and add tests
3. Run `pnpm typecheck && pnpm test` to verify
4. Open a pull request against `main`

For significant changes, open an issue first to discuss the approach.

## Reporting bugs

Open an issue at [github.com/piyushgupta344/structured-llm/issues](https://github.com/piyushgupta344/structured-llm/issues) with:
- structured-llm version
- Provider and model
- Minimal reproduction
- Expected vs actual behavior
