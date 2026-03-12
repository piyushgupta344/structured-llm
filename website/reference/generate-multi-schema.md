# generateMultiSchema()

Run the same prompt through multiple schemas simultaneously — get different structured views of the same input in one call.

```typescript
import { generateMultiSchema } from "structured-llm";

const { results } = await generateMultiSchema({
  client: openai,
  model: "gpt-4o-mini",
  prompt: contractText,
  schemas: {
    summary: SummarySchema,
    parties: PartiesSchema,
    risks: RiskSchema,
  },
});

console.log(results.summary.data);   // fully typed SummarySchema output
console.log(results.parties.data);   // fully typed PartiesSchema output
console.log(results.risks.data);     // fully typed RiskSchema output
```

## Options

```typescript
interface GenerateMultiSchemaOptions<M extends SchemaMap>
  extends Omit<GenerateOptions<ZodLike>, "schema"> {
  schemas: M;                   // map of label → Zod schema
  parallel?: boolean;           // run schemas concurrently, default: true
  continueOnError?: boolean;    // if false, throws on first schema error; default: true
}

// SchemaMap is just:
type SchemaMap = Record<string, ZodSchema>;
```

All the usual `GenerateOptions` fields (`client`, `provider`, `model`, `prompt`, `messages`, `temperature`, etc.) are supported.

## Return value

```typescript
interface MultiSchemaResults<M extends SchemaMap> {
  results: {
    [K in keyof M]: MultiSchemaItemResult<z.infer<M[K]>>;
  };
  totalUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

interface MultiSchemaItemResult<T> {
  data?: T;          // present on success
  error?: Error;     // present if this schema failed
  usage?: UsageInfo; // per-schema usage when trackUsage: true
  durationMs: number;
}
```

The result keys match your `schemas` keys exactly — TypeScript infers the types automatically.

## Examples

### Legal contract analysis

```typescript
import { z } from "zod";
import { generateMultiSchema } from "structured-llm";

const SummarySchema = z.object({
  title: z.string(),
  effectiveDate: z.string(),
  termMonths: z.number(),
});

const PartiesSchema = z.object({
  buyer: z.object({ name: z.string(), jurisdiction: z.string() }),
  seller: z.object({ name: z.string(), jurisdiction: z.string() }),
});

const RiskSchema = z.object({
  risks: z.array(z.object({
    description: z.string(),
    severity: z.enum(["low", "medium", "high"]),
  })),
});

const { results } = await generateMultiSchema({
  client: openai,
  model: "gpt-4o",
  prompt: contractText,
  schemas: { summary: SummarySchema, parties: PartiesSchema, risks: RiskSchema },
  trackUsage: true,
});

if (results.summary.data) {
  console.log("Contract:", results.summary.data.title);
}
if (results.risks.data) {
  const highRisks = results.risks.data.risks.filter((r) => r.severity === "high");
  console.log(`${highRisks.length} high-severity risks`);
}
```

### Handle partial failures

By default (`continueOnError: true`), a failed schema doesn't stop the others. Check each result individually:

```typescript
const { results } = await generateMultiSchema({
  client: openai,
  model: "gpt-4o-mini",
  prompt: document,
  schemas: { metadata: MetadataSchema, entities: EntitiesSchema, summary: SummarySchema },
});

for (const [key, result] of Object.entries(results)) {
  if (result.error) {
    console.warn(`${key} failed:`, result.error.message);
  } else {
    console.log(`${key}:`, result.data);
  }
}
```

### Sequential mode

Run schemas one at a time (useful for rate-limited APIs or debugging):

```typescript
const { results } = await generateMultiSchema({
  client: openai,
  model: "gpt-4o-mini",
  prompt: document,
  schemas: { a: SchemaA, b: SchemaB, c: SchemaC },
  parallel: false,
});
```

### Aggregate usage across schemas

```typescript
const { results, totalUsage } = await generateMultiSchema({
  client: openai,
  model: "gpt-4o-mini",
  prompt: document,
  schemas: { summary: SummarySchema, actions: ActionSchema },
  trackUsage: true,
});

console.log("Total tokens:", totalUsage?.totalTokens);
// Per-schema breakdown:
console.log("Summary tokens:", results.summary.usage?.totalTokens);
console.log("Actions tokens:", results.actions.usage?.totalTokens);
```

## When to use this

Use `generateMultiSchema` when:
- You need multiple structural views of the same document (e.g. metadata + entities + sentiment)
- Running schemas sequentially would be too slow
- Each schema extracts a different aspect and they're independent

Use [`generateBatch()`](/reference/generate-batch) instead when you have the same schema but many different inputs.
