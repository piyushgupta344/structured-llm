# API Reference

Complete reference for all public exports.

---

## Functions

### `generate<TSchema>(options)`

Extracts a single structured object from an LLM.

**Returns:** `Promise<GenerateResult<z.infer<TSchema>>>`

```typescript
interface GenerateResult<T> {
  data: T;           // fully typed, validated result
  usage?: UsageInfo; // only present when trackUsage: true
}
```

**Options:**

| Option | Type | Default | Description |
|---|---|---|---|
| `client` | any | — | Your provider client instance (auto-detected). One of `client` or `provider` is required. |
| `provider` | `ProviderName` | — | Provider name — reads API key from env. One of `client` or `provider` is required. |
| `apiKey` | string | — | API key. Optional if using env vars. |
| `baseURL` | string | — | Custom API endpoint. Required for Azure OpenAI. |
| `model` | string | **required** | Model identifier (e.g. `"gpt-4o-mini"`) |
| `schema` | `ZodType \| CustomSchema` | **required** | Zod schema or custom `{ jsonSchema, parse }` |
| `prompt` | string | — | User prompt. One of `prompt` or `messages` is required. |
| `messages` | `Message[]` | — | Full message history. One of `prompt` or `messages` is required. |
| `systemPrompt` | string | — | System message to prepend. Ignored if `messages` already contains a system message. |
| `mode` | `ExtractionMode` | `"auto"` | Extraction strategy. See [extraction modes](../README.md#extraction-modes). |
| `maxRetries` | number | `3` | Max validation+retry attempts. Set to `0` to disable retries. |
| `retryOptions` | `RetryOptions` | — | Fine-tune retry behavior. |
| `temperature` | number | `0` | LLM temperature (0–2). Lower = more consistent. |
| `maxTokens` | number | — | Max tokens in the response. |
| `trackUsage` | boolean | `false` | Include token count + cost in the result. |
| `hooks` | `Hooks` | — | Lifecycle callbacks. |
| `fallbackChain` | `FallbackEntry[]` | — | Providers to try if the primary fails. |

---

### `generateArray<TSchema>(options)`

Extracts a list of items. Pass the schema for a single item.

**Returns:** `Promise<GenerateArrayResult<z.infer<TSchema>>>`

```typescript
interface GenerateArrayResult<T> {
  data: T[];
  usage?: UsageInfo;
}
```

**Additional options (beyond `generate`):**

| Option | Type | Default | Description |
|---|---|---|---|
| `schema` | `ZodType` | **required** | Schema for a **single item** |
| `minItems` | number | — | Hint to include at least N items |
| `maxItems` | number | — | Hint to include at most N items |

---

### `generateStream<TSchema>(options)`

Returns an async iterable that yields partial objects as the response streams in. Also exposes a `.result` promise for the final validated value.

**Returns:** `AsyncIterable<StreamEvent<T>> & { result: Promise<{ data: T; usage?: UsageInfo }> }`

```typescript
type StreamEvent<T> =
  | { partial: Partial<T>; isDone: false }
  | { partial: T; isDone: true; usage?: UsageInfo };
```

Accepts the same options as `generate`. Requires a provider that supports streaming. Falls back to `complete()` for providers that don't.

---

### `createClient(config)`

Returns a `StructuredLLMClient` with pre-configured defaults.

```typescript
interface CreateClientOptions {
  client?: any;
  provider?: ProviderName;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  defaultOptions?: {
    mode?: ExtractionMode;
    maxRetries?: number;
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    trackUsage?: boolean;
    hooks?: Hooks;
    retryOptions?: RetryOptions;
  };
}

interface StructuredLLMClient {
  generate<TSchema>(opts): Promise<GenerateResult<z.infer<TSchema>>>;
  generateArray<TSchema>(opts): Promise<GenerateArrayResult<z.infer<TSchema>>>;
  generateStream<TSchema>(opts): AsyncIterable<StreamEvent<...>> & { result: Promise<...> };
}
```

Per-call options override defaults. When both global and per-call hooks are provided, both are called.

---

### `getModelCapabilities(model)`

Returns capability and pricing info for a registered model.

```typescript
interface ModelCapabilities {
  provider: ProviderName;
  toolCalling: boolean;
  jsonMode: boolean;
  streaming: boolean;
  contextWindow: number;
  inputCostPer1M?: number;   // USD per 1M input tokens
  outputCostPer1M?: number;  // USD per 1M output tokens
}

getModelCapabilities("gpt-4o-mini") // → ModelCapabilities
getModelCapabilities("unknown-model") // → undefined
```

---

### `listSupportedModels(filter?)`

Returns all registered model names, optionally filtered by provider.

```typescript
listSupportedModels()                        // → string[]  (all 35+ models)
listSupportedModels({ provider: "groq" })    // → string[]  (Groq models only)
```

---

### `resolveMode(model, preferred?)`

Returns the best extraction mode for a model, respecting an explicit override.

```typescript
resolveMode("gpt-4o-mini")              // → "tool-calling"
resolveMode("gpt-4o-mini", "json-mode") // → "json-mode"
resolveMode("gemma2-9b-it")             // → "json-mode"  (no tool calling support)
resolveMode("unknown-model")            // → "tool-calling"  (optimistic default)
```

---

## Types

### `ProviderName`

```typescript
type ProviderName =
  | "openai" | "anthropic" | "gemini" | "mistral"
  | "groq" | "azure-openai" | "xai" | "together"
  | "fireworks" | "perplexity" | "ollama" | "cohere" | "bedrock";
```

### `ExtractionMode`

```typescript
type ExtractionMode = "tool-calling" | "json-mode" | "prompt-inject" | "auto";
```

### `Message`

```typescript
interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}
```

### `RetryOptions`

```typescript
interface RetryOptions {
  maxRetries?: number;
  strategy?: "immediate" | "linear" | "exponential";
  baseDelayMs?: number;   // used for linear/exponential (default: 500)
}
```

### `UsageInfo`

```typescript
interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  latencyMs: number;
  attempts: number;
  model: string;
  provider: ProviderName;
}
```

### `Hooks<T>`

```typescript
interface Hooks<T = unknown> {
  onRequest?: (ctx: {
    messages: Message[];
    model: string;
    provider: ProviderName;
    attempt: number;
  }) => void | Promise<void>;

  onResponse?: (ctx: {
    rawResponse: string;
    attempt: number;
    model: string;
  }) => void | Promise<void>;

  onRetry?: (ctx: {
    attempt: number;
    maxRetries: number;
    error: string;
    model: string;
  }) => void | Promise<void>;

  onSuccess?: (ctx: {
    result: T;
    usage?: UsageInfo;
  }) => void | Promise<void>;

  onError?: (ctx: {
    error: Error;
    allAttempts: number;
  }) => void | Promise<void>;
}
```

### `FallbackEntry`

```typescript
interface FallbackEntry {
  client?: any;           // existing client instance
  provider?: ProviderName; // or provider name (reads from env)
  model: string;
  apiKey?: string;
  baseURL?: string;
}
```

### `CustomSchema<T>`

```typescript
interface CustomSchema<T = unknown> {
  jsonSchema: Record<string, unknown>;  // valid JSON Schema
  parse: (data: unknown) => T;          // throws on invalid input
  safeParse?: (data: unknown) =>        // optional — better error messages
    | { success: true; data: T }
    | { success: false; error: string };
}
```

---

## Errors

All errors extend `StructuredLLMError extends Error`.

### `ValidationError`

The LLM returned JSON that didn't match the schema, and retries were exhausted.

```typescript
err.issues        // string[] — validation error messages
err.lastResponse  // string — raw JSON that failed validation
err.attempts      // number — total attempts made
```

### `ParseError`

The LLM returned non-JSON content, and retries were exhausted.

```typescript
err.lastResponse  // string — the raw text the LLM returned
err.attempts      // number
```

### `ProviderError`

The provider API returned an error (network, auth, rate limit, etc.).

```typescript
err.provider       // ProviderName
err.statusCode     // number | undefined — HTTP status if available
err.originalError  // unknown — the raw error from the provider SDK
```

### `MaxRetriesError`

Retries were exhausted due to a mix of errors. (Rare — usually you'll see `ValidationError` or `ParseError`.)

```typescript
err.attempts   // number
err.lastError  // string — last error message
```

### `SchemaError`

An invalid schema was passed to `generate`.

### `MissingInputError`

Neither `prompt` nor `messages` was provided.

### `UnsupportedProviderError`

An unrecognized provider name or client instance was passed.
