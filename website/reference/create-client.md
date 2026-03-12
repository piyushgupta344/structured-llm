# createClient()

Create a reusable client that binds provider configuration and default options so you don't repeat them on every call.

```typescript
import { createClient } from "structured-llm";

const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    temperature: 0,
    trackUsage: true,
    maxRetries: 3,
  },
});

// All methods work the same as the standalone functions
const { data } = await llm.generate({ schema: MySchema, prompt: "..." });
const { data: list } = await llm.generateArray({ schema: ItemSchema, prompt: "..." });
```

## Options

```typescript
interface CreateClientOptions {
  // Provider — pass one of these
  client?: OpenAI | Anthropic | GoogleGenAI | Mistral | CohereClient;
  provider?: ProviderName;
  apiKey?: string;
  baseURL?: string;

  // Default model — can be overridden per-call
  model?: string;

  // Defaults applied to every call (per-call options take precedence)
  defaultOptions?: {
    mode?: ExtractionMode;
    maxRetries?: number;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    seed?: number;
    systemPrompt?: string;
    trackUsage?: boolean;
    hooks?: Hooks;
    retryOptions?: RetryOptions;
  };
}
```

## Methods

The client exposes all core functions with the provider and default options pre-bound:

| Method | Description |
|---|---|
| `llm.generate(opts)` | Same as `generate()`, omit `client`/`provider`/`apiKey`/`baseURL` |
| `llm.generateArray(opts)` | Same as `generateArray()` |
| `llm.generateStream(opts)` | Same as `generateStream()` |
| `llm.generateBatch(opts)` | Same as `generateBatch()` |
| `llm.classify(opts)` | Same as `classify()` |
| `llm.extract(opts)` | Same as `extract()` |
| `llm.generateMultiSchema(opts)` | Same as `generateMultiSchema()` |

Per-call options are **merged over** defaults. Hooks are **merged** (both global and per-call hooks fire).

## Examples

### Single client for the whole app

```typescript
// lib/llm.ts
import OpenAI from "openai";
import { createClient } from "structured-llm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    temperature: 0,
    maxRetries: 3,
    trackUsage: true,
  },
});
```

```typescript
// anywhere in the app
import { llm } from "./lib/llm";

const { data } = await llm.generate({
  schema: SentimentSchema,
  prompt: reviewText,
});
```

### Override model per-call

```typescript
const llm = createClient({ client: openai, model: "gpt-4o-mini" });

// Use the default model
const quick = await llm.generate({ schema: Schema, prompt: "..." });

// Override to a more capable model for complex tasks
const detailed = await llm.generate({
  model: "gpt-4o",
  schema: ComplexSchema,
  prompt: "...",
});
```

### Global hooks for logging

```typescript
const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    hooks: {
      onRequest: ({ model, provider, attempt }) => {
        console.log(`[LLM] → ${provider}/${model} (attempt ${attempt})`);
      },
      onSuccess: ({ usage }) => {
        if (usage) metricsClient.record("llm.tokens", usage.totalTokens);
      },
      onError: ({ error, allAttempts }) => {
        logger.error("LLM error after", allAttempts, "attempts:", error.message);
      },
    },
  },
});
```

### Multiple clients for different workloads

```typescript
// Fast cheap client for high-volume tasks
export const fastLLM = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: { temperature: 0, maxRetries: 2 },
});

// Powerful client for complex reasoning
export const powerLLM = createClient({
  client: anthropic,
  model: "claude-opus-4-6",
  defaultOptions: { temperature: 0.1, maxRetries: 5 },
});
```

### Using `provider` string instead of a client instance

```typescript
const llm = createClient({
  provider: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
});
```
