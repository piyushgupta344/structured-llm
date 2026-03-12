# generateBatch()

Run structured generation over a list of inputs with concurrency control and progress tracking.

```typescript
import { generateBatch } from "structured-llm";

const { succeeded, failed, totalUsage } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: SentimentSchema,
  inputs: reviews.map((r) => ({ prompt: r.text })),
  concurrency: 5,
  trackUsage: true,
});

console.log(`${succeeded.length} OK, ${failed.length} failed`);
```

## Options

```typescript
interface BatchOptions<TSchema> extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
  inputs: BatchInput[];       // list of prompts/messages to process
  concurrency?: number;       // max parallel requests, default: 3
  continueOnError?: boolean;  // if false, throws on first error; default: true
  onProgress?: (progress: BatchProgress) => void;
}

interface BatchInput {
  prompt?: string;
  messages?: Message[];
  systemPrompt?: string;     // overrides the base systemPrompt for this item
  temperature?: number;      // overrides base temperature for this item
  maxRetries?: number;       // overrides base maxRetries for this item
}
```

## Return value

```typescript
interface BatchResult<T> {
  items: BatchItemResult<T>[];      // all results in input order
  succeeded: BatchItemResult<T>[];  // items where data is defined
  failed: BatchItemResult<T>[];     // items where error is defined

  totalUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    totalDurationMs: number;
  };
}

interface BatchItemResult<T> {
  index: number;       // position in the original inputs array
  input: BatchInput;   // the input that produced this result
  data?: T;            // present on success
  usage?: UsageInfo;   // present if trackUsage: true and succeeded
  error?: Error;       // present on failure
  durationMs: number;  // wall time for this single item
}
```

## Progress tracking

```typescript
interface BatchProgress {
  completed: number;    // how many have finished (success or failure)
  total: number;        // total input count
  succeeded: number;
  failed: number;
  currentIndex: number; // index of the most recently finished item
}
```

## Examples

### Process a list of reviews

```typescript
import { z } from "zod";
import { generateBatch } from "structured-llm";

const SentimentSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(-1).max(1),
  summary: z.string(),
});

const reviews = [
  "Great product, fast shipping!",
  "Broke after a week, disappointing.",
  "Average quality, nothing special.",
];

const { succeeded, failed } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: SentimentSchema,
  inputs: reviews.map((text) => ({
    prompt: `Analyze the sentiment of this review: "${text}"`,
  })),
  concurrency: 3,
});

for (const item of succeeded) {
  console.log(reviews[item.index], "→", item.data?.sentiment);
}
```

### With progress callback

```typescript
const { items } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: ExtractionSchema,
  inputs: documents.map((d) => ({ prompt: d })),
  concurrency: 5,
  onProgress: ({ completed, total, failed }) => {
    process.stdout.write(`\r${completed}/${total} (${failed} failed)`);
  },
});
```

### Per-item overrides

```typescript
const { items } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: SummarySchema,
  inputs: [
    { prompt: shortDoc, maxRetries: 1 },         // simple doc, fewer retries
    { prompt: longDoc, temperature: 0.2 },        // longer doc, lower temp
    { prompt: technicalDoc, systemPrompt: "You are a technical writer." },
  ],
});
```

### Stop on first failure

```typescript
try {
  const result = await generateBatch({
    client: openai,
    model: "gpt-4o-mini",
    schema: Schema,
    inputs: items,
    continueOnError: false, // throws immediately on first error
  });
} catch (err) {
  console.error("Batch stopped:", err.message);
}
```

### Aggregate costs

```typescript
const { totalUsage } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: Schema,
  inputs: largeDataset,
  concurrency: 10,
  trackUsage: true,
});

if (totalUsage) {
  console.log(`Total: ${totalUsage.totalTokens} tokens`);
  console.log(`Cost: $${totalUsage.estimatedCostUsd?.toFixed(4)}`);
  console.log(`Duration: ${(totalUsage.totalDurationMs / 1000).toFixed(1)}s`);
}
```

## Concurrency guide

| Data size | Recommended concurrency |
|---|---|
| < 10 items | 3 (default) |
| 10–100 items | 5–10 |
| 100–1000 items | 10–20 |
| 1000+ items | Start at 10, watch for 429s |

Rate limits vary by provider and tier. If you're seeing `ProviderError` with status 429, lower `concurrency` or add `retryOptions` with exponential backoff.

## See also

- [`generateMultiSchema()`](/reference/generate-multi-schema) — run multiple schemas against the same prompt in parallel
- [Batch processing example](/examples/batch)
