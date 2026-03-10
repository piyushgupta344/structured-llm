---
layout: home

hero:
  name: "structured-llm"
  text: "Typed structured output from any LLM."
  tagline: Bring your own OpenAI / Anthropic / Gemini client. Get back Zod-validated objects with full TypeScript types. No SDK lock-in.
  image:
    src: /hero.svg
    alt: structured-llm
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/piyushgupta344/structured-llm
    - theme: alt
      text: Try Playground
      link: /playground

features:
  - icon: 🔌
    title: Bring your own client
    details: Pass an existing OpenAI, Anthropic, Gemini, Mistral, or Cohere client. No new SDK to learn.
  - icon: 🛡️
    title: Zero runtime dependencies
    details: Zod is a peer dependency. The library itself adds nothing to your bundle.
  - icon: ♻️
    title: Automatic retry with error feedback
    details: When validation fails, the error is sent back to the LLM with instructions to fix it. Up to 3 retries by default.
  - icon: 🔄
    title: Fallback chain
    details: Define multiple provider+model pairs. The library tries each one in order on provider failures.
  - icon: ⚡
    title: Streaming partial objects
    details: Yield typed partial objects as tokens come in. Perfect for real-time UIs.
  - icon: 📦
    title: Batch processing
    details: Process hundreds of inputs with controlled concurrency, progress callbacks, and aggregated usage.
  - icon: 🏷️
    title: classify() and extract()
    details: High-level helpers for the most common tasks — no schema boilerplate.
  - icon: 💰
    title: Usage tracking
    details: Token counts and estimated cost per call, for every provider.
---

## See it in action

```typescript
import OpenAI from "openai";
import { z } from "zod";
import { generate } from "structured-llm";

const openai = new OpenAI();

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: z.object({
    sentiment: z.enum(["positive", "negative", "neutral"]),
    score: z.number().min(0).max(1),
    tags: z.array(z.string()),
  }),
  prompt: "The new MacBook completely changed how I work.",
});

console.log(data.sentiment); // "positive" — fully typed, no casting
console.log(data.score);     // 0.94
console.log(data.tags);      // ["productivity", "hardware", "apple"]
```

```bash
npm install structured-llm zod
```

[→ Read the full guide](/guide/getting-started)
