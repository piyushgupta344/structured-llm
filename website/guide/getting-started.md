# Quick Start

Get structured, typed output from any LLM in under 5 minutes.

## Install

```bash
npm install structured-llm zod
# or
pnpm add structured-llm zod
# or
yarn add structured-llm zod
```

Install the SDK for your provider:

```bash
npm install openai                    # OpenAI, Groq, xAI, Together, Fireworks, Perplexity, Ollama, Azure
npm install @anthropic-ai/sdk         # Anthropic Claude
npm install @google/genai             # Google Gemini
npm install @mistralai/mistralai      # Mistral
npm install cohere-ai                 # Cohere
```

## Your first structured call

```typescript
import OpenAI from "openai";
import { z } from "zod";
import { generate } from "structured-llm";

const openai = new OpenAI(); // reads OPENAI_API_KEY from env

const ReviewSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(0).max(1),
  summary: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
});

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: ReviewSchema,
  prompt: `
    Review: "Incredible battery life and the display is stunning.
    A bit pricey but worth every penny for power users."
  `,
});

console.log(data.sentiment);  // "positive"
console.log(data.score);      // 0.88
console.log(data.pros);       // ["battery life", "display quality"]
console.log(data.cons);       // ["high price"]
// data is fully typed as z.infer<typeof ReviewSchema>
```

## Extract without writing a schema

For quick extraction without defining a full Zod schema:

```typescript
import { extract } from "structured-llm";

const data = await extract({
  client: openai,
  model: "gpt-4o-mini",
  prompt: "John Smith, john@example.com, +1 555-0123, San Francisco CA",
  fields: {
    name: "string",
    email: "email",
    phone: "phone",
    city: "string",
  },
});

console.log(data.name);   // "John Smith"
console.log(data.email);  // "john@example.com"
```

## Classify text

```typescript
import { classify } from "structured-llm";

const { label, confidence } = await classify({
  client: openai,
  model: "gpt-4o-mini",
  prompt: "My payment was charged twice this month.",
  options: ["billing", "auth", "bug", "feature-request"],
  includeConfidence: true,
});

console.log(label);      // "billing"
console.log(confidence); // 0.97
```

## Extract a list

Pass the schema for one item, get back a typed array:

```typescript
import { generateArray } from "structured-llm";

const { data: transactions } = await generateArray({
  client: openai,
  model: "gpt-4o-mini",
  schema: z.object({
    date: z.string(),
    merchant: z.string(),
    amount: z.number(),
    category: z.enum(["food", "transport", "shopping", "other"]),
  }),
  prompt: bankStatementText,
});

// transactions is typed Transaction[]
console.log(transactions.length);        // 12
console.log(transactions[0].merchant);   // "Whole Foods"
```

## Use Anthropic instead of OpenAI

Just swap the client — everything else stays the same:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { generate } from "structured-llm";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

const { data } = await generate({
  client: anthropic,
  model: "claude-haiku-4-5",
  schema: ReviewSchema,
  prompt: reviewText,
});
```

## What's next

- [Providers](/guide/providers) — setup for Gemini, Mistral, Groq, Ollama, and more
- [generate() reference](/reference/generate) — all options documented
- [Retry & fallback](/concepts/retry) — how to handle failures reliably
- [Examples](/examples/overview) — 40 runnable examples
