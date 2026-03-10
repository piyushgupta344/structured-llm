# Providers

structured-llm supports 13 providers. The library **auto-detects** which one you're using from the client instance — no config needed.

## OpenAI

```bash
npm install openai
```

```typescript
import OpenAI from "openai";
import { generate } from "structured-llm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",    // or gpt-4o, gpt-4-turbo, o1-mini, etc.
  schema: MySchema,
  prompt: "...",
});
```

**Recommended models:** `gpt-4o-mini` (fast + cheap), `gpt-4o` (best quality)

## Anthropic

```bash
npm install @anthropic-ai/sdk
```

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

generate({ client: anthropic, model: "claude-sonnet-4-6", schema, prompt });
```

**Recommended models:** `claude-haiku-4-5` (fast), `claude-sonnet-4-6` (best quality)

::: tip
Anthropic doesn't have a native JSON mode. The library automatically embeds the schema in the system prompt and uses tool calling when available.
:::

## Google Gemini

```bash
npm install @google/genai
```

```typescript
import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

generate({ client: gemini, model: "gemini-2.0-flash", schema, prompt });
```

**Recommended models:** `gemini-2.0-flash` (fast), `gemini-1.5-pro` (best quality)

## Mistral

```bash
npm install @mistralai/mistralai
```

```typescript
import { Mistral } from "@mistralai/mistralai";

const mistral = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

generate({ client: mistral, model: "mistral-small-latest", schema, prompt });
```

## Cohere

```bash
npm install cohere-ai
```

```typescript
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

generate({ client: cohere, model: "command-r-plus", schema, prompt });
```

## OpenAI-compatible providers

These all use the OpenAI SDK pointed at a different base URL. The library detects them automatically.

### Groq — fastest inference

```typescript
import OpenAI from "openai";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

generate({ client: groq, model: "llama-3.3-70b-versatile", schema, prompt });
```

### xAI (Grok)

```typescript
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});
generate({ client: xai, model: "grok-2", schema, prompt });
```

### Together AI

```typescript
const together = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});
generate({ client: together, model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", schema, prompt });
```

### Fireworks AI

```typescript
const fireworks = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
});
```

### Perplexity

```typescript
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: "https://api.perplexity.ai",
});
```

### Ollama (local, free)

Run models locally with [Ollama](https://ollama.ai):

```bash
ollama pull llama3.2
```

```typescript
const ollama = new OpenAI({
  apiKey: "ollama",
  baseURL: "http://localhost:11434/v1",
});

generate({
  client: ollama,
  model: "llama3.2",
  mode: "json-mode",    // local models usually don't support tool calling
  schema,
  prompt,
});
```

### Azure OpenAI

```typescript
const azure = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `https://${process.env.AZURE_RESOURCE}.openai.azure.com/openai/deployments/${process.env.AZURE_DEPLOYMENT}`,
  defaultQuery: { "api-version": "2024-02-01" },
  defaultHeaders: { "api-key": process.env.AZURE_OPENAI_API_KEY },
});
```

## Initialize from environment variables

Skip client creation — pass a `provider` string:

```typescript
generate({
  provider: "openai",     // reads OPENAI_API_KEY
  provider: "anthropic",  // reads ANTHROPIC_API_KEY
  provider: "gemini",     // reads GEMINI_API_KEY
  provider: "groq",       // reads GROQ_API_KEY
  provider: "ollama",     // no key needed, connects to localhost:11434
  model: "...",
  schema,
  prompt,
});
```
