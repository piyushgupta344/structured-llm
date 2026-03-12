# Hooks

Hooks are lifecycle callbacks that fire at key points in the generation pipeline. Use them for logging, metrics, debugging, and observability — without changing your call sites.

## Available hooks

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

  onChunk?: (ctx: {
    partial: Partial<T>;
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

### Hook lifecycle

```
onRequest → (LLM call) → onResponse → [parse/validate]
                                           ↓ pass
                                       onSuccess
                                           ↓ fail + retry
                                       onRetry → onRequest → ...
                                           ↓ fail + no retries left
                                       onError
```

`onChunk` fires during `generateStream()` for each partial update.

## Setting hooks

Pass hooks directly on any call:

```typescript
const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: MySchema,
  prompt: "...",
  hooks: {
    onRequest: ({ model, attempt }) => console.log(`→ ${model} (attempt ${attempt})`),
    onSuccess: ({ usage }) => console.log(`← ${usage?.totalTokens} tokens`),
  },
});
```

Or set global defaults on a client — per-call hooks are **merged** with global ones (both fire):

```typescript
const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    hooks: {
      onError: ({ error }) => logger.error("LLM error", error),
    },
  },
});

// This call fires both the global onError and the local onRetry
const { data } = await llm.generate({
  schema: Schema,
  prompt: "...",
  hooks: {
    onRetry: ({ attempt, maxRetries }) => console.log(`retry ${attempt}/${maxRetries}`),
  },
});
```

## Examples

### Request/response logging

```typescript
generate({
  // ...
  hooks: {
    onRequest: ({ messages, model, provider, attempt }) => {
      console.log(`[LLM] → ${provider}/${model} (attempt ${attempt})`);
      console.log("       messages:", messages.map((m) => `${m.role}: ${m.content.slice(0, 80)}`));
    },
    onResponse: ({ rawResponse, attempt }) => {
      console.log(`[LLM] ← attempt ${attempt}:`, rawResponse.slice(0, 200));
    },
  },
});
```

### Metrics with DataDog / Prometheus

```typescript
const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    trackUsage: true,
    hooks: {
      onSuccess: ({ usage }) => {
        if (!usage) return;
        metrics.increment("llm.requests.success", { model: usage.model });
        metrics.gauge("llm.tokens", usage.totalTokens, { model: usage.model });
        metrics.timing("llm.latency", usage.latencyMs);
      },
      onRetry: ({ attempt, error, model }) => {
        metrics.increment("llm.retries", { model, attempt: String(attempt) });
      },
      onError: ({ error }) => {
        metrics.increment("llm.requests.error", { type: error.constructor.name });
      },
    },
  },
});
```

### Streaming progress with onChunk

```typescript
const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "Write a detailed analysis...",
  hooks: {
    onChunk: ({ partial }) => {
      // Update UI as fields appear
      if (partial.title) updateTitle(partial.title);
      if (partial.sections) updateProgress(partial.sections.length);
    },
    onSuccess: ({ result }) => {
      markComplete(result);
    },
  },
});

for await (const _ of stream) { /* consume */ }
```

### Audit logging

```typescript
generate({
  // ...
  hooks: {
    onRequest: async ({ messages, model, provider }) => {
      await auditLog.write({
        event: "llm_request",
        model,
        provider,
        inputHash: sha256(JSON.stringify(messages)),
        timestamp: new Date(),
      });
    },
    onSuccess: async ({ result, usage }) => {
      await auditLog.write({
        event: "llm_success",
        outputHash: sha256(JSON.stringify(result)),
        tokens: usage?.totalTokens,
      });
    },
  },
});
```

### Abort on budget exceeded

```typescript
let totalCost = 0;

const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    trackUsage: true,
    hooks: {
      onSuccess: ({ usage }) => {
        totalCost += usage?.estimatedCostUsd ?? 0;
        if (totalCost > 1.00) {
          throw new Error("Monthly LLM budget exceeded ($1.00)");
        }
      },
    },
  },
});
```

## Notes

- Hooks are `async` — you can `await` inside them. structured-llm awaits each hook before continuing.
- Throwing inside a hook propagates the error to the caller.
- `onChunk` only fires during `generateStream()` and `generateArrayStream()`, not `generate()`.
- When hooks are merged via `createClient` + per-call hooks, both fire in order: global first, then local.
