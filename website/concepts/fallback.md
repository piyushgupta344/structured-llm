# Fallback Chain

Define a prioritized list of providers and models to try if the primary call fails. structured-llm automatically moves to the next entry on API errors, rate limits, or network failures.

```typescript
import { generate } from "structured-llm";

const { data } = await generate({
  client: openai,
  model: "gpt-4o",
  schema: MySchema,
  prompt: "...",
  fallbackChain: [
    { client: openai, model: "gpt-4o-mini" },         // cheaper OpenAI fallback
    { provider: "anthropic", model: "claude-haiku-4-5-20251001" }, // cross-provider fallback
  ],
});
```

## FallbackEntry

```typescript
interface FallbackEntry {
  client?: OpenAI | Anthropic | GoogleGenAI | Mistral | CohereClient;
  provider?: ProviderName;
  model: string;
  apiKey?: string;
  baseURL?: string;
}
```

Each entry can use a pre-existing client instance or a `provider` string (which will create a new client using `apiKey` or the standard env var for that provider).

## How it works

1. structured-llm attempts the primary `client` + `model`
2. If the attempt throws a `ProviderError` (any API error), it moves to `fallbackChain[0]`
3. Each fallback gets the same full retry budget (`maxRetries`) before the chain advances
4. If all entries fail, the last error is thrown

```
Primary (gpt-4o)          → 500 error
  → Fallback 1 (gpt-4o-mini)     → rate limited (429)
  → Fallback 2 (claude-haiku)    → success ✓
```

## Examples

### Multi-provider high-availability

```typescript
const { data } = await generate({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o",
  schema: Schema,
  prompt: "...",
  fallbackChain: [
    {
      provider: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-sonnet-4-6",
    },
    {
      provider: "gemini",
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.0-flash",
    },
  ],
});
```

### Cost-tiered fallback

Start with the best model and fall back to cheaper options:

```typescript
const { data } = await generate({
  client: openai,
  model: "gpt-4o",             // try the best first
  schema: ComplexSchema,
  prompt: "...",
  fallbackChain: [
    { client: openai, model: "gpt-4o-mini" },   // cheaper if quota exceeded
    { provider: "groq", model: "llama-3.1-8b-instant" }, // fastest/cheapest last resort
  ],
});
```

### Observing fallbacks with hooks

```typescript
const { data } = await generate({
  client: openai,
  model: "gpt-4o",
  schema: Schema,
  prompt: "...",
  fallbackChain: [{ client: anthropic, model: "claude-haiku-4-5-20251001" }],
  hooks: {
    onError: ({ error, allAttempts }) => {
      metrics.increment("llm.fallback", {
        error: error.message,
        attempts: allAttempts,
      });
    },
  },
});
```

## What triggers a fallback

| Situation | Moves to fallback? |
|---|---|
| Provider API error (4xx, 5xx) | yes |
| Rate limit (429) | yes |
| Network timeout | yes |
| Parse error after all retries | yes |
| Validation error after all retries | yes |

## What doesn't trigger a fallback

- `MissingInputError` — this is a programming error (no prompt provided)
- `SchemaError` — invalid schema definition

## Fallback vs retry

Retries handle **transient** failures within the same provider (bad JSON, validation issues) — see [Retry Logic](/concepts/retry).

Fallbacks handle **provider-level** failures (outages, quota exhaustion, model unavailability) by switching to a different provider or model entirely.
