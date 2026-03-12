# Usage Tracking

Track token consumption and estimated cost per call — useful for budgeting, monitoring, and per-user billing.

## Enabling usage tracking

Pass `trackUsage: true` to any `generate*` call or set it in `defaultOptions` on a client:

```typescript
const { data, usage } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: MySchema,
  prompt: "...",
  trackUsage: true,
});

console.log(usage?.totalTokens);       // 342
console.log(usage?.estimatedCostUsd);  // 0.0000513
```

## UsageInfo shape

```typescript
interface UsageInfo {
  promptTokens: number;       // tokens in the request
  completionTokens: number;   // tokens in the response
  totalTokens: number;        // sum of the above
  estimatedCostUsd?: number;  // estimated cost based on known pricing
  latencyMs: number;          // wall time from request to response
  attempts: number;           // number of attempts (1 = no retries needed)
  model: string;              // the model that produced this response
  provider: ProviderName;     // the provider that handled the request
}
```

`estimatedCostUsd` is based on publicly listed pricing and is an approximation — actual billing may differ. It is `undefined` for models not in the pricing registry.

## Per-function support

| Function | `usage` in return value |
|---|---|
| `generate()` | yes |
| `generateArray()` | yes |
| `generateStream()` | yes — on the final `isDone` event and in `.result` |
| `generateBatch()` | yes — per item and aggregated in `totalUsage` |
| `generateMultiSchema()` | yes — per schema and aggregated in `totalUsage` |
| `classify()` | yes |
| `extract()` | yes |

## Batch aggregation

`generateBatch` and `generateMultiSchema` aggregate usage across all sub-calls:

```typescript
const { succeeded, totalUsage } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: Schema,
  inputs: items,
  trackUsage: true,
});

if (totalUsage) {
  console.log("Total tokens:", totalUsage.totalTokens);
  console.log("Total cost:  $" + totalUsage.estimatedCostUsd?.toFixed(4));
  console.log("Duration:    " + (totalUsage.totalDurationMs / 1000).toFixed(1) + "s");
}
```

## Tracking with the `onSuccess` hook

For centralized monitoring without plumbing `usage` through every call site:

```typescript
import { createClient } from "structured-llm";

const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    trackUsage: true,
    hooks: {
      onSuccess: ({ usage }) => {
        if (!usage) return;
        metricsClient.gauge("llm.tokens.total", usage.totalTokens, {
          model: usage.model,
          provider: usage.provider,
        });
        metricsClient.gauge("llm.cost.usd", usage.estimatedCostUsd ?? 0, {
          model: usage.model,
        });
        metricsClient.timing("llm.latency.ms", usage.latencyMs);
      },
    },
  },
});
```

## Per-user cost tracking

```typescript
async function generateForUser(userId: string, prompt: string) {
  const { data, usage } = await generate({
    client: openai,
    model: "gpt-4o-mini",
    schema: Schema,
    prompt,
    trackUsage: true,
  });

  if (usage?.estimatedCostUsd) {
    await db.userUsage.upsert({
      userId,
      tokensUsed: usage.totalTokens,
      costUsd: usage.estimatedCostUsd,
      timestamp: new Date(),
    });
  }

  return data;
}
```

## Notes

- Token counts come from the provider API response when available. For providers that don't return counts, structured-llm estimates using a rough `characters / 4` approximation.
- `latencyMs` includes the full round-trip time from the first request to final validated output, including any retry attempts.
- `attempts` reflects the total number of LLM calls made (retries included). An `attempts` value > 1 means a retry occurred.
