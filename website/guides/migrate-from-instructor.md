# Migrating from instructor-js

If you're coming from [instructor-js](https://github.com/instructor-ai/instructor-js), the concepts map cleanly. Here's how to switch.

## Key differences

| | instructor-js | structured-llm |
|---|---|---|
| Providers | OpenAI only | 13 providers |
| Schema | Zod | Zod or custom |
| Streaming | no | yes |
| Fallback chain | no | yes |
| Batch processing | no | yes |
| `classify()` / `extract()` | no | yes |
| Bundle size | adds deps | zero runtime deps |

## Side-by-side comparison

### Basic extraction

**instructor-js:**
```typescript
import Instructor from "@instructor-ai/instructor";
import OpenAI from "openai";
import { z } from "zod";

const client = Instructor({ client: new OpenAI(), mode: "TOOLS" });

const user = await client.chat.completions.create({
  model: "gpt-4o-mini",
  response_model: { schema: UserSchema, name: "User" },
  messages: [{ role: "user", content: "Extract: Alice, 28, alice@example.com" }],
});
```

**structured-llm:**
```typescript
import { generate } from "structured-llm";
import OpenAI from "openai";

const { data: user } = await generate({
  client: new OpenAI(),
  model: "gpt-4o-mini",
  schema: UserSchema,
  prompt: "Extract: Alice, 28, alice@example.com",
});
```

### Retry handling

**instructor-js:**
```typescript
const client = Instructor({ client: new OpenAI(), mode: "TOOLS" });

await client.chat.completions.create({
  model: "gpt-4o-mini",
  response_model: { schema: MySchema, name: "Result" },
  max_retries: 3,
  messages: [{ role: "user", content: "..." }],
});
```

**structured-llm:**
```typescript
await generate({
  client: new OpenAI(),
  model: "gpt-4o-mini",
  schema: MySchema,
  prompt: "...",
  maxRetries: 3,
});
```

### Streaming

instructor-js doesn't support streaming structured output. structured-llm does:

```typescript
import { generateStream } from "structured-llm";

const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "Write a detailed analysis...",
});

for await (const event of stream) {
  if (!event.isDone) {
    // render partial data in real-time
    updateUI(event.partial);
  }
}
```

### Multiple providers

instructor-js is OpenAI-only. With structured-llm you can use any provider, or set up a fallback chain:

```typescript
import Anthropic from "@anthropic-ai/sdk";

// Use Anthropic
generate({ client: new Anthropic(), model: "claude-haiku-4-5", schema, prompt });

// Fallback: try Anthropic first, fall back to OpenAI
generate({
  client: new Anthropic(),
  model: "claude-sonnet-4-6",
  schema,
  prompt,
  fallbackChain: [
    { client: new OpenAI(), model: "gpt-4o-mini" },
  ],
});
```

## Migration checklist

- [ ] Replace `Instructor({ client, mode })` with just passing `client` directly to `generate()`
- [ ] Replace `response_model: { schema, name }` with `schema`
- [ ] Replace `messages: [...]` with `prompt` (or keep `messages` — both work)
- [ ] Replace `max_retries` with `maxRetries`
- [ ] Remove `@instructor-ai/instructor` from dependencies
