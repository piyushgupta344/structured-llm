# Provider Guide

Every supported provider, how to connect, which models to use, and what features each one supports.

---

## OpenAI

**Install:** `npm install openai`

```typescript
import OpenAI from "openai";
import { generate } from "structured-llm";

const openai = new OpenAI(); // reads OPENAI_API_KEY from env

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: MySchema,
  prompt: "...",
});
```

**Recommended models:**

| Model | Context | Tool calling | JSON mode | Cost (input/output per 1M) |
|---|---|---|---|---|
| `gpt-4o` | 128K | Yes | Yes | $2.50 / $10.00 |
| `gpt-4o-mini` | 128K | Yes | Yes | $0.15 / $0.60 |
| `o3-mini` | 200K | Yes | Yes | $1.10 / $4.40 |
| `gpt-3.5-turbo` | 16K | Yes | Yes | $0.50 / $1.50 |

`gpt-4o-mini` is the best default: cheap, fast, accurate, supports tool calling.

---

## Anthropic

**Install:** `npm install @anthropic-ai/sdk`

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

generate({ client, model: "claude-haiku-4-5", ... })
```

Anthropic uses **tool use** for structured extraction and doesn't have a native JSON response mode — the library embeds the schema in the system prompt for json-mode fallback.

**Recommended models:**

| Model | Context | Tool calling | Cost (input/output per 1M) |
|---|---|---|---|
| `claude-opus-4-6` | 200K | Yes | $15.00 / $75.00 |
| `claude-sonnet-4-6` | 200K | Yes | $3.00 / $15.00 |
| `claude-haiku-4-5` | 200K | Yes | $0.80 / $4.00 |

`claude-haiku-4-5` is excellent for structured extraction — fast, cheap, high accuracy.

---

## Gemini

**Install:** `npm install @google/genai`

```typescript
import { GoogleGenAI } from "@google/genai";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

generate({ client, model: "gemini-2.0-flash", ... })
```

Gemini supports both function calling and a native `responseMimeType: "application/json"` mode. The library uses function calling by default (more reliable) and falls back to JSON mode for models that don't support it.

**Recommended models:**

| Model | Context | Tool calling | JSON mode | Cost (input/output per 1M) |
|---|---|---|---|---|
| `gemini-2.0-flash` | 1M | Yes | Yes | $0.10 / $0.40 |
| `gemini-2.0-flash-lite` | 1M | Yes | Yes | $0.075 / $0.30 |
| `gemini-1.5-pro` | 2M | Yes | Yes | $1.25 / $5.00 |
| `gemini-1.5-flash` | 1M | Yes | Yes | $0.075 / $0.30 |

`gemini-2.0-flash` has an enormous context window for the price — great for long document processing.

---

## Mistral

**Install:** `npm install @mistralai/mistralai`

```typescript
import { Mistral } from "@mistralai/mistralai";

const client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });

generate({ client, model: "mistral-large-latest", ... })
```

**Recommended models:**

| Model | Context | Tool calling | JSON mode | Cost (input/output per 1M) |
|---|---|---|---|---|
| `mistral-large-latest` | 131K | Yes | Yes | $2.00 / $6.00 |
| `mistral-small-latest` | 131K | Yes | Yes | $0.20 / $0.60 |
| `mistral-nemo` | 131K | Yes | Yes | $0.15 / $0.15 |
| `codestral-latest` | 256K | Yes | Yes | $0.30 / $0.90 |

---

## Groq

Fast inference for open models. Uses the OpenAI SDK.

**Install:** `npm install openai`

```typescript
import OpenAI from "openai";

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

generate({ client: groq, model: "llama-3.3-70b-versatile", ... })
```

Or use the provider shorthand:

```typescript
generate({ provider: "groq", model: "llama-3.3-70b-versatile", ... })
```

**Recommended models:**

| Model | Context | Tool calling | JSON mode | Cost (input/output per 1M) |
|---|---|---|---|---|
| `llama-3.3-70b-versatile` | 128K | Yes | Yes | $0.59 / $0.79 |
| `llama-3.1-8b-instant` | 128K | Yes | Yes | $0.05 / $0.08 |
| `mixtral-8x7b-32768` | 32K | Yes | Yes | $0.24 / $0.24 |

Groq is exceptionally fast — worth using for latency-sensitive applications. `llama-3.1-8b-instant` is the cheapest option that still supports tool calling.

---

## xAI (Grok)

**Install:** `npm install openai`

```typescript
import OpenAI from "openai";

const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

generate({ client: xai, model: "grok-2", ... })
```

---

## Together AI

Large selection of open-source models.

**Install:** `npm install openai`

```typescript
import OpenAI from "openai";

const together = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});

generate({ client: together, model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", ... })
```

**Notable models:**
- `meta-llama/Llama-3.3-70B-Instruct-Turbo` — strong general reasoning, tool calling
- `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` — cheap, fast
- `Qwen/Qwen2.5-72B-Instruct-Turbo` — excellent for structured extraction

---

## Fireworks AI

Fast open model inference.

**Install:** `npm install openai`

```typescript
import OpenAI from "openai";

const fireworks = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
});

generate({ client: fireworks, model: "accounts/fireworks/models/llama-v3p1-70b-instruct", ... })
```

---

## Perplexity

Good for tasks that need real-time search context. Limited structured output support — use `json-mode` or `prompt-inject`.

**Install:** `npm install openai`

```typescript
import OpenAI from "openai";

const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: "https://api.perplexity.ai",
});

generate({ client: perplexity, model: "llama-3.1-sonar-large-128k-online", mode: "json-mode", ... })
```

---

## Ollama (local)

Run models locally — zero API cost. Requires [Ollama](https://ollama.ai) running.

```bash
# Install Ollama: https://ollama.ai
ollama pull llama3.2
ollama pull qwen2.5
ollama serve   # starts on localhost:11434
```

```typescript
import OpenAI from "openai";

const ollama = new OpenAI({
  apiKey: "ollama",   // required by SDK, value doesn't matter
  baseURL: "http://localhost:11434/v1",
});

generate({
  client: ollama,
  model: "llama3.2",
  mode: "json-mode",   // most local models work best with json-mode
  schema: MySchema,
  prompt: "...",
})
```

**Recommended models for structured output:**

| Model | Params | Tool calling | Notes |
|---|---|---|---|
| `qwen2.5` | 7B | Yes | Best overall for structured extraction |
| `llama3.2` | 3B | Yes | Good balance of size and accuracy |
| `llama3.1` | 8B | Yes | Solid, widely used |
| `mistral` | 7B | No | Use `json-mode` |
| `phi4` | 14B | No | Good reasoning, no tool support |

---

## Cohere

**Install:** `npm install cohere-ai`

```typescript
import { CohereClient } from "cohere-ai";

const client = new CohereClient({ token: process.env.COHERE_API_KEY });

generate({ client, model: "command-r-plus", ... })
```

Note: Cohere uses a different tool parameter format than OpenAI. The library handles this conversion automatically. Only flat (non-nested) schemas work reliably with Cohere's tool calling — for complex nested schemas, use `json-mode` instead:

```typescript
generate({ client, model: "command-r-plus", mode: "json-mode", ... })
```

---

## Azure OpenAI

Azure requires a `baseURL` pointing to your deployment endpoint.

```typescript
import OpenAI from "openai";

const azure = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: "https://your-resource-name.openai.azure.com/openai/deployments/your-deployment-name",
});

generate({ client: azure, model: "gpt-4o", ... })
```

The `model` parameter should match your Azure deployment name.

---

## Choosing a provider

Quick decision guide:

| Need | Recommendation |
|---|---|
| Best accuracy | `claude-opus-4-6` or `gpt-4o` |
| Best price/accuracy | `gpt-4o-mini` or `claude-haiku-4-5` |
| Lowest latency | Groq with `llama-3.1-8b-instant` |
| Largest context | Gemini 1.5 Pro (2M tokens) |
| Zero cost | Ollama with `qwen2.5` |
| Open source models | Together AI or Groq |
| No external API | Ollama (local) |
