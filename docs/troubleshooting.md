# Troubleshooting

Common issues and how to fix them.

---

## ValidationError after multiple retries

The LLM keeps returning data that doesn't pass your schema.

**Check your schema for impossible constraints.** A schema like `z.number().min(0).max(1)` applied to a field you're asking the LLM to "rate out of 10" will always fail. Make the schema match your prompt.

**Use `temperature: 0`.** Higher temperatures increase randomness and make validation failures more likely.

**Add descriptions to your schema fields.** Zod's `.describe()` method adds context that gets included in the JSON Schema:

```typescript
z.object({
  score: z.number().min(0).max(1).describe("Confidence score between 0 (no confidence) and 1 (certain)"),
})
```

**Check the `lastResponse` on the error:**

```typescript
try {
  await generate({ ... });
} catch (err) {
  if (err instanceof ValidationError) {
    console.log("LLM returned:", err.lastResponse);
    console.log("Issues:", err.issues);
  }
}
```

---

## ParseError — LLM returned non-JSON

The LLM is returning prose or markdown instead of JSON.

**Switch to `tool-calling` mode** if you aren't already. It forces the LLM to output structured JSON:

```typescript
generate({ ..., mode: "tool-calling" })
```

**Use the `onResponse` hook to see what the LLM is actually returning:**

```typescript
generate({
  ...,
  hooks: {
    onResponse: ({ rawResponse }) => console.log("Raw:", rawResponse),
  },
})
```

**For local models (Ollama),** use `json-mode` or `prompt-inject` — many local models don't support tool calling:

```typescript
generate({ ..., mode: "json-mode" })
```

---

## ProviderError: 401 — Authentication failed

Your API key is missing or wrong.

```bash
# Check env vars are set
echo $OPENAI_API_KEY
echo $ANTHROPIC_API_KEY
```

Make sure the key is being passed correctly:

```typescript
// Option 1: env var (recommended)
const openai = new OpenAI(); // reads OPENAI_API_KEY automatically

// Option 2: explicit
const openai = new OpenAI({ apiKey: "sk-..." });

// Option 3: provider shorthand
generate({ provider: "openai", apiKey: "sk-...", model: "gpt-4o-mini", ... })
```

---

## ProviderError: 429 — Rate limit

You're hitting the provider's rate limit.

Use `retryOptions` with exponential backoff:

```typescript
generate({
  ...,
  maxRetries: 5,
  retryOptions: {
    strategy: "exponential",
    baseDelayMs: 1000,
  },
})
```

Or set up a fallback chain to a different provider:

```typescript
generate({
  client: openai,
  model: "gpt-4o",
  fallbackChain: [
    { provider: "anthropic", model: "claude-haiku-4-5" },
  ],
  ...
})
```

---

## "Could not detect provider from client"

The library couldn't figure out which provider your client belongs to.

This usually means the client constructor name was changed by a bundler (minification renames classes). The library also checks API shape (which methods exist), so this is rare — but if it happens, file an issue with your setup details.

As a workaround, you can always use the `provider` + `apiKey` approach instead of passing a client:

```typescript
generate({ provider: "openai", apiKey: process.env.OPENAI_API_KEY, model: "gpt-4o-mini", ... })
```

---

## Gemini: schema validation errors or unexpected output

Gemini is picky about JSON Schema format. The library strips unsupported keywords (`$schema`, `$defs`, etc.) automatically, but complex schemas with `$ref` or deeply nested `anyOf` can sometimes cause issues.

Simplify your schema if possible. For complex schemas, use `mode: "json-mode"` instead of `tool-calling` with Gemini.

---

## TypeScript: "Type X is not assignable to type Y"

Make sure you're on TypeScript 5+ and that `strict` mode is enabled in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

If you're getting inference issues with `z.infer<typeof MySchema>`, make sure your Zod schema is defined with `const` (not `let`):

```typescript
const MySchema = z.object({ ... }); // ✓
let MySchema = z.object({ ... });   // ✗ — type is wider
```

---

## Streaming: partial objects not updating

If you're only getting one event and it's `isDone: true`, the provider might not support streaming or the adapter's `stream()` method isn't implemented.

Check if streaming is supported:

```typescript
import { getModelCapabilities } from "structured-llm";

const caps = getModelCapabilities("your-model");
console.log(caps?.streaming); // true / false / undefined (unknown)
```

For models/providers without streaming support, `generateStream` falls back to `complete()` automatically — you'll get a single event with `isDone: true` and the full result.

---

## Ollama: ECONNREFUSED

Ollama isn't running. Start it:

```bash
ollama serve
```

Or install it first: [ollama.ai](https://ollama.ai)

Then pull a model:

```bash
ollama pull llama3.2
```

---

## Still stuck?

Open an issue with:
- The exact error message and stack trace
- Your schema definition
- Your provider and model
- Your Node.js and `structured-llm` versions
