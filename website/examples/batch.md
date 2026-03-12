# Batch Processing

Run structured generation over large datasets with concurrency control, error handling, and cost tracking.

## Basic batch

```typescript
import { z } from "zod";
import { generateBatch } from "structured-llm";

const SummarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
});

const articles = await fetchArticles(); // array of strings

const { succeeded, failed } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: SummarySchema,
  inputs: articles.map((text) => ({ prompt: `Summarize:\n\n${text}` })),
  concurrency: 5,
});

console.log(`${succeeded.length} summaries, ${failed.length} errors`);
```

## Processing with progress and cost tracking

```typescript
import { generateBatch } from "structured-llm";

const { succeeded, failed, totalUsage } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: ExtractionSchema,
  inputs: documents.map((doc) => ({
    prompt: doc.content,
    systemPrompt: "Extract key entities and relationships.",
  })),
  concurrency: 8,
  trackUsage: true,
  onProgress: ({ completed, total, succeeded, failed }) => {
    const pct = Math.round((completed / total) * 100);
    process.stdout.write(
      `\r[${pct}%] ${completed}/${total} — ${succeeded} ok, ${failed} failed`
    );
  },
});

console.log();
console.log(`Total tokens: ${totalUsage?.totalTokens}`);
console.log(`Estimated cost: $${totalUsage?.estimatedCostUsd?.toFixed(4)}`);
console.log(`Duration: ${((totalUsage?.totalDurationMs ?? 0) / 1000).toFixed(1)}s`);
```

## Per-item configuration

Each input can override temperature, retries, and system prompt:

```typescript
const inputs = [
  // Simple items — fast, fewer retries
  { prompt: shortText, temperature: 0, maxRetries: 1 },
  // Complex items — more retries, lower temperature
  { prompt: longText, temperature: 0, maxRetries: 5 },
  // Item with specialized system prompt
  { prompt: technicalDoc, systemPrompt: "You are a technical analyst." },
];

const { items } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: Schema,
  inputs,
  continueOnError: true,
});

for (const item of items) {
  if (item.error) {
    console.error(`Item ${item.index} failed:`, item.error.message);
  } else {
    console.log(`Item ${item.index}:`, item.data);
  }
}
```

## Retry failed items

`generateBatch` puts failures in the `failed` array. You can retry them separately:

```typescript
const { succeeded, failed } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: Schema,
  inputs: allInputs,
  concurrency: 5,
});

if (failed.length > 0) {
  console.log(`Retrying ${failed.length} failed items with a more capable model...`);

  const { succeeded: retried } = await generateBatch({
    client: openai,
    model: "gpt-4o",  // upgrade to better model for retries
    schema: Schema,
    inputs: failed.map((f) => f.input),
    concurrency: 2,   // slower, since these are harder
    maxRetries: 5,
  });

  succeeded.push(...retried);
}

console.log(`Final: ${succeeded.length} succeeded`);
```

## Competitor analysis across many companies

```typescript
import { z } from "zod";
import { generateBatch } from "structured-llm";

const CompetitorSchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  pricing: z.string(),
  targetMarket: z.string(),
  differentiators: z.array(z.string()),
});

const competitors = [
  "Salesforce CRM",
  "HubSpot",
  "Pipedrive",
  "Zoho CRM",
  "Microsoft Dynamics",
];

const { succeeded } = await generateBatch({
  client: openai,
  model: "gpt-4o",
  schema: CompetitorSchema,
  inputs: competitors.map((name) => ({
    prompt: `Analyze ${name} as a CRM competitor. Focus on the SMB market segment.`,
  })),
  concurrency: 3,
});

const report = succeeded.map((item) => ({
  company: competitors[item.index],
  ...item.data,
}));
```

## Concurrency tuning

| Scenario | Recommended concurrency |
|---|---|
| Free tier / low quota | 1–2 |
| Standard tier | 5–10 |
| High-volume tier | 10–20 |
| Seeing 429 errors | Cut in half |

Set `retryOptions` to handle transient rate limits automatically:

```typescript
generateBatch({
  // ...
  maxRetries: 3,
  retryOptions: {
    strategy: "exponential",
    baseDelayMs: 1000,
  },
});
```
