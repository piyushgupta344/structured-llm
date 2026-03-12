# Streaming

Show partial results to users as the LLM generates them — dramatically reduces perceived latency.

## Basic streaming

```typescript
import { z } from "zod";
import { generateStream } from "structured-llm";

const ReportSchema = z.object({
  title: z.string(),
  summary: z.string(),
  keyFindings: z.array(z.string()),
  recommendations: z.array(z.string()),
  riskLevel: z.enum(["low", "medium", "high"]),
});

const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "Generate a market analysis report for electric vehicles in 2025",
});

for await (const event of stream) {
  if (!event.isDone) {
    // Show partial data as it arrives
    if (event.partial.title) {
      console.clear();
      console.log("Title:", event.partial.title);
    }
    if (event.partial.summary) {
      console.log("Summary:", event.partial.summary);
    }
    if (event.partial.keyFindings?.length) {
      console.log("Findings so far:", event.partial.keyFindings.length);
    }
  } else {
    // event.partial is the complete, validated object
    console.log("\nFinal report:", event.partial);
    console.log("Tokens used:", event.usage?.totalTokens);
  }
}
```

## Streaming to Next.js clients

### Route handler (NDJSON)

```typescript
// app/api/generate/route.ts
import { z } from "zod";
import { generateStream } from "structured-llm";

const AnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  topics: z.array(z.string()),
  summary: z.string(),
});

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const stream = generateStream({
    client: openai,
    model: "gpt-4o",
    schema: AnalysisSchema,
    prompt,
    signal: request.signal,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        }
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(JSON.stringify({ error: msg }) + "\n"));
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
```

### Client-side consumption

```typescript
async function streamAnalysis(prompt: string, onPartial: (data: unknown) => void) {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split("\n").filter(Boolean);
    for (const line of lines) {
      const event = JSON.parse(line);
      if (event.error) throw new Error(event.error);
      if (!event.isDone) onPartial(event.partial);
      if (event.isDone) return event.partial;
    }
  }
}
```

## Streaming with the built-in Next.js helper

Use `createStreamingRoute` from `structured-llm/integrations/next` to skip the boilerplate:

```typescript
// app/api/report/route.ts
import { createStreamingRoute } from "structured-llm/integrations/next";

export const POST = createStreamingRoute({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
});
```

The client sends `{ prompt, messages?, systemPrompt? }` and receives NDJSON events.

## Streaming an array of items

Use `generateArrayStream` to stream items as they complete rather than waiting for the full list:

```typescript
import { generateArrayStream } from "structured-llm";
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  category: z.string(),
  rating: z.number().min(0).max(5),
});

const stream = generateArrayStream({
  client: openai,
  model: "gpt-4o",
  schema: ProductSchema,
  prompt: "List 15 top-selling electronics products for 2025",
});

for await (const { items, isDone } of stream) {
  if (!isDone) {
    console.log(`${items.length} products loaded so far...`);
    renderProductList(items); // update UI progressively
  } else {
    console.log("All done:", items.length, "products");
  }
}

// Or just get the final result
const { data: products } = await stream.result;
```

## Abort a stream

```typescript
const controller = new AbortController();

// Cancel after 10 seconds
const timeout = setTimeout(() => controller.abort(), 10_000);

const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "...",
  signal: controller.signal,
});

try {
  for await (const event of stream) {
    if (userClickedCancel) {
      controller.abort();
      break;
    }
    updateUI(event.partial);
  }
} catch (err) {
  if (controller.signal.aborted) {
    console.log("Cancelled by user");
  } else {
    throw err;
  }
} finally {
  clearTimeout(timeout);
}
```

## Using onChunk hook

Get chunk callbacks without changing your streaming loop:

```typescript
const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "...",
  hooks: {
    onChunk: ({ partial }) => {
      // This fires on every partial update
      broadcastToWebSocket(partial);
    },
    onSuccess: ({ result, usage }) => {
      logAnalytics({ tokens: usage?.totalTokens });
    },
  },
});

// Consume the stream (or just await .result)
const { data } = await stream.result;
```
