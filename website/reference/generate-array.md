# generateArray()

Extract a typed array of objects from any LLM in a single call.

```typescript
import { generateArray } from "structured-llm";

const { data } = await generateArray({
  client: openai,
  model: "gpt-4o-mini",
  schema: ItemSchema,
  prompt: "List the top 5 programming languages in 2025",
});
// data is ItemSchema[] — fully validated
```

## Options

`generateArray` accepts all the same options as [`generate()`](/reference/generate), plus:

```typescript
interface GenerateArrayOptions<TSchema> extends GenerateOptions<TSchema> {
  minItems?: number;   // hint the LLM to return at least N items
  maxItems?: number;   // hint the LLM to return at most N items
}
```

## Return value

```typescript
interface GenerateArrayResult<T> {
  data: T[];           // validated array — always an array, never undefined
  usage?: UsageInfo;   // only present if trackUsage: true
}
```

## Examples

### Basic list extraction

```typescript
import { z } from "zod";
import { generateArray } from "structured-llm";

const SkillSchema = z.object({
  name: z.string(),
  level: z.enum(["beginner", "intermediate", "expert"]),
  yearsOfExperience: z.number().int().min(0),
});

const { data } = await generateArray({
  client: openai,
  model: "gpt-4o-mini",
  schema: SkillSchema,
  prompt: "Extract all skills from this resume: ...",
});

for (const skill of data) {
  console.log(`${skill.name} — ${skill.level}`);
}
```

### With item count bounds

```typescript
const { data } = await generateArray({
  client: openai,
  model: "gpt-4o-mini",
  schema: RecommendationSchema,
  prompt: "Give me product recommendations for a home office",
  minItems: 3,
  maxItems: 8,
});
```

### Processing many documents

```typescript
const documents = ["doc1...", "doc2...", "doc3..."];

const results = await Promise.all(
  documents.map((doc) =>
    generateArray({
      client: openai,
      model: "gpt-4o-mini",
      schema: EntitySchema,
      prompt: `Extract named entities from: ${doc}`,
    })
  )
);
```

### With usage tracking

```typescript
const { data, usage } = await generateArray({
  client: openai,
  model: "gpt-4o-mini",
  schema: ItemSchema,
  prompt: "...",
  trackUsage: true,
});

console.log(`Got ${data.length} items, used ${usage?.totalTokens} tokens`);
```

## How it works

`generateArray` wraps your schema in `{ items: z.array(schema) }` and asks the model to return an array under the `items` key. This gives tool-calling and JSON-mode providers a concrete schema to target, rather than asking them to produce a bare array (which some providers handle inconsistently).

The `minItems` / `maxItems` bounds are injected as natural-language hints into the prompt — they are not enforced at the schema level. If the model returns fewer items than `minItems`, validation still passes.

## Streaming variant

To receive items as they complete rather than waiting for the full response, use [`generateArrayStream()`](/reference/generate-stream#generatearraystream).
