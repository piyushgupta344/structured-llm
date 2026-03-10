# Next.js Integration

structured-llm works in any Node.js environment, including Next.js API routes and Server Actions. Here's how to set it up.

## Installation

```bash
npm install structured-llm zod openai
```

## API Routes (App Router)

```typescript
// app/api/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generate } from "structured-llm";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  summary: z.string(),
  keyPoints: z.array(z.string()),
});

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  const { data } = await generate({
    client: openai,
    model: "gpt-4o-mini",
    schema: AnalysisSchema,
    prompt: text,
  });

  return NextResponse.json(data);
}
```

## Streaming with Server-Sent Events

```typescript
// app/api/stream/route.ts
import { generateStream } from "structured-llm";

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const llmStream = generateStream({
        client: openai,
        model: "gpt-4o",
        schema: ReportSchema,
        prompt,
      });

      for await (const event of llmStream) {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
```

## Server Actions

```typescript
// app/actions.ts
"use server";

import { z } from "zod";
import { generate } from "structured-llm";

const ContactSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
});

export async function extractContact(text: string) {
  const { data } = await generate({
    provider: "openai",     // reads OPENAI_API_KEY from env
    model: "gpt-4o-mini",
    schema: ContactSchema,
    prompt: text,
  });
  return data;
}
```

## Creating a reusable client

```typescript
// lib/llm.ts
import { createClient } from "structured-llm";
import OpenAI from "openai";

// Create once, reuse across your app
export const llm = createClient({
  client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  model: "gpt-4o-mini",
  defaultOptions: {
    maxRetries: 2,
    trackUsage: true,
    hooks: {
      onSuccess: ({ usage }) => {
        // log to your analytics
        console.log(`Cost: $${usage?.estimatedCostUsd}`);
      },
    },
  },
});
```

```typescript
// app/api/classify/route.ts
import { llm } from "@/lib/llm";

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  const result = await llm.classify({
    prompt: message,
    options: ["support", "sales", "billing"],
    includeConfidence: true,
  });
  return NextResponse.json(result);
}
```

## Environment variables

```bash
# .env.local
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=...
```

::: warning Edge Runtime
structured-llm requires the Node.js runtime (`runtime = 'nodejs'`). It does not support the Edge runtime because provider SDKs depend on Node.js APIs.
:::
