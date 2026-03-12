# generateStream()

Stream a structured object as it's generated — get partial results in real time.

```typescript
import { generateStream } from "structured-llm";

const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "Write a detailed market analysis for EVs in 2025",
});

for await (const event of stream) {
  if (event.isDone) {
    console.log("Final:", event.partial);  // fully validated T
  } else {
    console.log("Partial:", event.partial); // Partial<T>
  }
}
```

## Options

`generateStream` accepts the same options as [`generate()`](/reference/generate).

## Return value

`generateStream` returns an object that is both an `AsyncIterable` and has a `.result` promise:

```typescript
// Async iterable — yields partial objects as they stream
AsyncIterable<StreamEvent<T>>

// Promise — resolves when the stream finishes and validation passes
result: Promise<{ data: T; usage?: UsageInfo }>
```

### StreamEvent

Each event yielded during iteration is one of:

```typescript
// Mid-stream — partial data as it's generated
interface StreamChunk<T> {
  partial: Partial<T>;
  isDone: false;
}

// Final event — fully parsed and validated
interface StreamFinal<T> {
  partial: T;          // same field name, but now the complete object
  isDone: true;
  usage?: UsageInfo;
}
```

## Examples

### Basic streaming

```typescript
import { z } from "zod";
import { generateStream } from "structured-llm";

const ArticleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  readingTimeMinutes: z.number(),
});

const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ArticleSchema,
  prompt: "Write an article about the future of remote work",
});

for await (const event of stream) {
  if (!event.isDone && event.partial.title) {
    process.stdout.write(`Title: ${event.partial.title}\r`);
  }
  if (event.isDone) {
    console.log("\nDone:", event.partial);
  }
}
```

### Using the `.result` promise

When you only need the final value but want to avoid blocking until the full response arrives:

```typescript
const stream = generateStream({ ... });

// Start consuming the stream in background (optional — for progress)
(async () => {
  for await (const event of stream) {
    if (!event.isDone) updateProgressUI(event.partial);
  }
})();

// Await the final validated result
const { data } = await stream.result;
```

### Streaming to the browser via Next.js

```typescript
// app/api/generate/route.ts
import { generateStream } from "structured-llm";

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const stream = generateStream({
    client: openai,
    model: "gpt-4o",
    schema: ReportSchema,
    prompt,
    signal: request.signal,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
```

### With the `onChunk` hook

```typescript
const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "...",
  hooks: {
    onChunk: ({ partial, model }) => {
      console.log(`[${model}] partial fields: ${Object.keys(partial).join(", ")}`);
    },
  },
});

for await (const _ of stream) { /* consume */ }
```

### Abort mid-stream

```typescript
const controller = new AbortController();

setTimeout(() => controller.abort(), 5000); // cancel after 5s

const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "...",
  signal: controller.signal,
});

try {
  for await (const event of stream) {
    if (event.isDone) console.log(event.partial);
  }
} catch (err) {
  console.log("Aborted or failed:", err.message);
}
```

## generateArrayStream()

Stream array items as they complete. Each event contains the cumulative list of fully-parsed items seen so far.

```typescript
import { generateArrayStream } from "structured-llm";

const stream = generateArrayStream({
  client: openai,
  model: "gpt-4o",
  schema: ProductSchema,
  prompt: "List the top 20 electronics products for 2025",
});

for await (const { items, isDone } of stream) {
  console.log(`${items.length} items so far`);
  if (isDone) console.log("Final list:", items);
}

// Or await the final result directly
const { data } = await stream.result;
```

### ArrayStreamEvent

```typescript
interface ArrayStreamEvent<T> {
  items: T[];          // cumulative list of fully-parsed items
  isDone: boolean;
  usage?: UsageInfo;   // only on the final event when trackUsage: true
}
```

## Notes on retry

`generateStream` retries on **rate-limit errors** (429, 502, 503, 529) with exponential backoff, rolling back any partial events from the failed attempt before retrying. It does **not** retry on validation failures — use `generate()` if you need validation retry with error feedback.
