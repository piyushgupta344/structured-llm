# Introduction

`structured-llm` is a TypeScript library that makes it reliable to get structured, typed data back from any LLM.

## The problem

Calling an LLM and getting usable data is harder than it should be:

```typescript
// What you write today
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Extract the invoice data as JSON: " + text }],
});

const raw = response.choices[0].message.content;
// Now what?
const data = JSON.parse(raw); // might throw
// data is `any` — no types, no validation
// What if the LLM returned a field with the wrong type?
// What if it wrapped the JSON in markdown fences?
// What if it missed a required field?
```

Every production LLM app ends up with the same fragile scaffolding: JSON extraction, validation, retry loops, type assertions. And it all lives in your app code, duplicated across every feature.

## What structured-llm does

```typescript
const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: InvoiceSchema,   // your existing Zod schema
  prompt: text,
});

// data is fully typed as z.infer<typeof InvoiceSchema>
// If the LLM returned bad JSON — retried automatically
// If it failed validation — errors sent back to LLM with a fix prompt
// If the provider is down — falls back to your fallback chain
```

One function call. Full types. No scaffolding.

## Design principles

**Bring your own client.** You already have an OpenAI or Anthropic client. We don't ask you to swap it for ours. Pass it in, we handle the rest.

**Zero runtime dependencies.** Zod is a peer dependency — if you already have it (you do), we add nothing to your bundle.

**Explicit over magic.** Retry logic, fallback behavior, and extraction mode are all configurable. Sensible defaults, but nothing hidden.

**Works with everything.** OpenAI, Anthropic, Gemini, Mistral, Cohere, Groq, xAI, Together AI, Fireworks, Perplexity, Ollama, Azure OpenAI — and any OpenAI-compatible endpoint.

## Comparison

|  | structured-llm | Vercel AI SDK | instructor-js |
|---|---|---|---|
| Bring your own client | **yes** | no | partial |
| Zero runtime deps | **yes** | no | no |
| 13+ providers | **yes** | yes | OpenAI only |
| Streaming partial objects | **yes** | yes | no |
| Fallback chain | **yes** | no | no |
| Retry with error feedback | **yes** | basic | yes |
| Custom schema (no Zod) | **yes** | no | no |
| `classify()` / `extract()` helpers | **yes** | no | no |
| Batch processing | **yes** | no | no |
| Works with local Ollama | **yes** | limited | no |

## Next steps

- [Quick Start →](/guide/getting-started) — install and run your first structured call in 5 minutes
- [Providers →](/guide/providers) — setup for every supported provider
- [API Reference →](/reference/generate) — complete documentation for every function
