<p align="center">
  <h1 align="center">structured-llm</h1>
  <p align="center">Zod-validated, fully-typed structured output from any LLM — bring your own client.</p>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/structured-llm"><img src="https://img.shields.io/npm/v/structured-llm?color=crimson&label=npm" alt="npm version" /></a>
  <a href="https://github.com/piyushgupta344/structured-llm/actions"><img src="https://img.shields.io/github/actions/workflow/status/piyushgupta344/structured-llm/ci.yml?branch=main&label=tests" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/structured-llm"><img src="https://img.shields.io/npm/dm/structured-llm?label=downloads" alt="downloads" /></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6" alt="TypeScript" />
  <img src="https://img.shields.io/badge/zero-runtime%20deps-4caf50" alt="zero deps" />
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/structured-llm" alt="MIT License" /></a>
</p>

---

```bash
npm install structured-llm zod
```

```typescript
import { generate } from "structured-llm";
import { z } from "zod";

const { data } = await generate({
  client: openai,       // pass your existing OpenAI / Anthropic / Gemini / Mistral client
  model: "gpt-4o-mini",
  schema: z.object({
    sentiment: z.enum(["positive", "negative", "neutral"]),
    score: z.number().min(0).max(1),
    tags: z.array(z.string()),
  }),
  prompt: "Analyze: The new MacBook completely changed how I work.",
});

console.log(data.sentiment); // "positive"
console.log(data.score);     // 0.94
console.log(data.tags);      // ["productivity", "hardware", "apple"]
// fully typed — no casting, no guessing
```

---

## Why another structured output library?

You have a few options today:

| | structured-llm | Vercel AI SDK | instructor-js |
|---|---|---|---|
| Bring your own client | **yes** | no (their SDK) | partial |
| Zero runtime dependencies | **yes** | no | no |
| 13 providers | **yes** | yes | OpenAI only |
| Streaming partial objects | **yes** | yes | no |
| Fallback chain | **yes** | no | no |
| Retry with error feedback | **yes** | basic | yes |
| Custom schema (no Zod) | **yes** | no | no |
| Works with local Ollama | **yes** | limited | no |

`structured-llm` has one job: take any LLM client you already have, take a Zod schema you already wrote, give back a typed object. No ecosystem lock-in.

---

## Table of contents

- [Installation](#installation)
- [Core functions](#core-functions)
  - [generate](#generate)
  - [generateArray](#generatearray)
  - [generateStream](#generatestream)
  - [generateBatch](#generatebatch)
  - [generateMultiSchema](#generatemultischema)
  - [createClient](#createclient)
- [High-level helpers](#high-level-helpers)
  - [classify](#classify)
  - [extract](#extract)
  - [createTemplate](#createtemplate)
  - [withCache](#withcache)
- [Providers](#providers)
- [Extraction modes](#extraction-modes)
- [Retry logic](#retry-logic)
- [Fallback chain](#fallback-chain)
- [Usage tracking](#usage-tracking)
- [Hooks](#hooks)
- [Error handling](#error-handling)
- [Custom schemas](#custom-schemas-no-zod)
- [Framework integrations](#framework-integrations)
- [Examples](#examples)
- [Contributing](#contributing)

---

## Installation

```bash
npm install structured-llm zod
# or
pnpm add structured-llm zod
# or
yarn add structured-llm zod
```

Install only the provider SDKs you actually use:

```bash
npm install openai                    # OpenAI, Groq, xAI, Together, Fireworks, Ollama, Azure
npm install @anthropic-ai/sdk         # Anthropic
npm install @google/genai             # Gemini
npm install @mistralai/mistralai      # Mistral
npm install cohere-ai                 # Cohere
```

**Requires:** Node.js 18+, TypeScript 5+ (strict mode recommended)

---

## Core functions

### `generate`

Extracts a single structured object from the LLM.

```typescript
import OpenAI from "openai";
import { z } from "zod";
import { generate } from "structured-llm";

const openai = new OpenAI(); // reads OPENAI_API_KEY from env

const InvoiceSchema = z.object({
  vendor: z.string(),
  amount: z.number(),
  currency: z.string().length(3),
  dueDate: z.string().describe("ISO 8601 date"),
  lineItems: z.array(z.object({
    description: z.string(),
    quantity: z.number(),
    unitPrice: z.number(),
  })),
  isPaid: z.boolean(),
});

const { data, usage } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: InvoiceSchema,
  prompt: invoiceText,
  systemPrompt: "You are a precise invoice parser.",
  temperature: 0,
  maxRetries: 3,
  trackUsage: true,
});

// data is fully typed as z.infer<typeof InvoiceSchema>
console.log(data.vendor);        // "Acme Corp"
console.log(data.lineItems[0]);  // { description: "...", quantity: 2, unitPrice: 49.99 }
console.log(usage?.estimatedCostUsd); // 0.000043
```

**All options:**

```typescript
generate({
  // Provider — one of these two forms
  client: openai,              // pass an existing client (auto-detected)
  // OR
  provider: "openai",          // reads API key from env (OPENAI_API_KEY)
  apiKey: "sk-...",            // or pass the key directly
  baseURL: "...",              // optional custom endpoint

  model: "gpt-4o-mini",        // required
  schema: MyZodSchema,         // required — Zod or custom schema

  // Input — use prompt, messages, or both
  prompt: "...",
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
  ],
  systemPrompt: "...",         // shorthand for a system message

  // Extraction
  mode: "auto",                // "auto" | "tool-calling" | "json-mode" | "prompt-inject"

  // Retry
  maxRetries: 3,
  retryOptions: {
    strategy: "exponential",   // "immediate" | "linear" | "exponential"
    baseDelayMs: 500,
  },

  // Generation params
  temperature: 0,
  maxTokens: 1000,

  // Observability
  trackUsage: false,
  hooks: { ... },

  // Fallback
  fallbackChain: [ ... ],
});
```

---

### `generateArray`

Extracts a list of items. Pass the schema for a single item, get back an array.

```typescript
import { generateArray } from "structured-llm";
import { z } from "zod";

const TransactionSchema = z.object({
  date: z.string(),
  merchant: z.string(),
  amount: z.number(),
  category: z.enum(["food", "transport", "shopping", "utilities", "other"]),
});

const { data } = await generateArray({
  client: openai,
  model: "gpt-4o-mini",
  schema: TransactionSchema,     // schema for ONE transaction
  prompt: bankStatementText,
  minItems: 1,                   // hint to the LLM
  maxItems: 100,
});

// data is Transaction[]
const total = data.reduce((sum, t) => sum + t.amount, 0);
console.log(`${data.length} transactions, total: $${total.toFixed(2)}`);
```

---

### `generateStream`

Streams the response, yielding partial objects as fields come in. Useful for long outputs or real-time UIs.

```typescript
import { generateStream } from "structured-llm";
import { z } from "zod";

const ReportSchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
    keyPoints: z.array(z.string()),
  })),
  conclusion: z.string(),
  riskLevel: z.enum(["low", "medium", "high"]),
});

const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "Write a comprehensive market analysis for the EV industry in 2025.",
});

// Iterate over partial updates
for await (const event of stream) {
  if (event.isDone) {
    console.log("Complete:", event.partial.title);
    console.log("Sections:", event.partial.sections?.length);
  } else {
    // Partial<ReportSchema> — render what you have so far
    process.stdout.write(".");
  }
}

// Or just await the final validated result
const { data } = await stream.result;
```

---

### `generateBatch`

Process many inputs against the same schema with controlled concurrency. Handles partial failures, progress callbacks, and aggregated usage stats.

```typescript
import { generateBatch } from "structured-llm";

const { items, succeeded, failed, totalUsage } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: SentimentSchema,
  inputs: reviews.map((text) => ({ prompt: text })),
  concurrency: 5,          // max parallel API calls (default 3)
  continueOnError: true,   // don't throw on individual failures (default true)
  onProgress: ({ completed, total, succeeded, failed }) => {
    console.log(`${completed}/${total} (${failed} failed)`);
  },
});

console.log(`${succeeded.length}/${items.length} succeeded`);
console.log(`Total cost: $${totalUsage?.estimatedCostUsd.toFixed(4)}`);

// Results are in original input order
items.forEach(({ index, data, error, durationMs }) => {
  if (error) console.log(`[${index}] failed: ${error.message}`);
  else console.log(`[${index}] ${data.sentiment} (${durationMs}ms)`);
});
```

---

### `generateMultiSchema`

Run the same input through multiple Zod schemas simultaneously. Useful when you need different structured views of the same document.

```typescript
import { generateMultiSchema } from "structured-llm";

const { results, totalUsage } = await generateMultiSchema({
  client: openai,
  model: "gpt-4o-mini",
  prompt: contractText,
  schemas: {
    keyTerms: KeyTermsSchema,      // parties, dates, governing law
    risks: RiskAssessmentSchema,   // red flags, severity scores
    obligations: ObligationSchema, // what each party must do
  },
  parallel: true,          // run all schemas concurrently (default true)
  continueOnError: true,   // individual schema failures don't abort others
});

console.log(results.keyTerms.data);    // KeyTerms | undefined
console.log(results.risks.data);       // RiskAssessment | undefined
console.log(results.obligations.data); // Obligations | undefined
console.log(results.risks.error);      // Error | undefined
```

---

### `createClient`

Pre-configure a client once, call it many times. Useful when you're making lots of calls with the same provider/model/settings.

```typescript
import { createClient } from "structured-llm";
import OpenAI from "openai";

const llm = createClient({
  client: new OpenAI(),
  model: "gpt-4o-mini",
  defaultOptions: {
    temperature: 0,
    maxRetries: 2,
    trackUsage: true,
    hooks: {
      onSuccess: ({ usage }) => {
        db.insert({ tokens: usage?.totalTokens, cost: usage?.estimatedCostUsd });
      },
    },
  },
});

// All calls inherit the defaults — override per-call as needed
const { data: sentiment } = await llm.generate({
  schema: SentimentSchema,
  prompt: "Analyze this review: ...",
});

const { data: entities } = await llm.generateArray({
  schema: EntitySchema,
  prompt: "Extract all named entities from: ...",
  temperature: 0.2,              // overrides defaultOptions.temperature
});

const stream = llm.generateStream({
  schema: ReportSchema,
  prompt: "Write a report on...",
});

// All new helpers are also available on the client
const result = await llm.classify({ ... });
const data = await llm.extract({ ... });
const { results } = await llm.generateMultiSchema({ ... });
const batchResult = await llm.generateBatch({ ... });
```

---

## High-level helpers

### `classify`

Classify text into one of your categories. No schema boilerplate needed — pass an array of labels and get back a typed result.

```typescript
import { classify } from "structured-llm";

const { label, confidence, reasoning } = await classify({
  client: openai,
  model: "gpt-4o-mini",
  prompt: "My payment was charged twice last week.",
  options: [
    { value: "billing", description: "Charge, refund, subscription issues" },
    { value: "auth", description: "Login, password, account access" },
    { value: "bug", description: "App not working as expected" },
    { value: "how-to", description: "Questions about how to use the product" },
  ],
  includeConfidence: true,   // 0–1 confidence score
  includeReasoning: true,    // one-sentence explanation
  allowMultiple: false,      // set true for multi-label classification
});

console.log(label);      // "billing"
console.log(confidence); // 0.97
console.log(reasoning);  // "User reports a duplicate charge, a billing issue."
```

With `allowMultiple: true`, the response has a `labels` array:

```typescript
const { labels } = await classify({
  ...,
  allowMultiple: true,
  prompt: "URGENT: can't log in and my card was charged $500 I didn't authorize",
  options: ["billing", "auth", "urgent", "fraud"],
});
// labels: ["billing", "auth", "urgent", "fraud"]
```

---

### `extract`

Extract specific fields from free-form text without writing a full Zod schema. Fields are optional by default — the LLM omits what it can't find.

```typescript
import { extract } from "structured-llm";

const data = await extract({
  client: openai,
  model: "gpt-4o-mini",
  prompt: invoiceText,
  fields: {
    // shorthand — just a type string
    invoiceNumber: "string",
    totalAmount: "number",
    issueDate: "date",      // "string" | "number" | "boolean" | "date" | "email" | "phone" | "url" | "integer"

    // full FieldDef for more control
    vendorEmail: {
      type: "email",
      description: "Vendor's billing email address",
      required: true,        // validation error if missing
    },
    status: {
      type: "string",
      options: ["draft", "sent", "paid", "overdue"],  // enum
    },
  },
  requireAll: false,     // make all fields required at once
});

console.log(data.invoiceNumber); // "INV-2024-00842"
console.log(data.totalAmount);   // 10476
console.log(data.issueDate);     // "2024-03-05"
```

---

### `createTemplate`

Bind a prompt template to a schema and config. Reuse it across your app with different variable substitutions.

```typescript
import { createTemplate } from "structured-llm";

const analyzeDoc = createTemplate({
  template: "Analyze this {{docType}} from {{company}}:\n\n{{content}}",
  schema: AnalysisSchema,
  client: openai,
  model: "gpt-4o-mini",
  systemPrompt: "You are a business analyst.",
  temperature: 0,
});

// run with variable substitution
const { data } = await analyzeDoc.run({
  docType: "contract",
  company: "Acme Corp",
  content: contractText,
});

// run as array extraction
const { data: items } = await analyzeDoc.runArray({
  docType: "meeting notes",
  company: "TechCo",
  content: notesText,
});

// preview the rendered prompt (no API call)
const prompt = analyzeDoc.render({ docType: "invoice", company: "Acme", content: "..." });
```

Variables use `{{double_braces}}` syntax. An error is thrown if a variable is missing at runtime.

---

### `withCache`

Wrap `generate()` with TTL-based memoization. Identical prompts + model combinations skip the API and return the cached result.

```typescript
import { withCache } from "structured-llm";

const cachedGenerate = withCache({
  ttl: 5 * 60 * 1000,  // 5 minute TTL (default)
  debug: true,          // log cache hits/misses
  // store: customStore  // optional custom cache backend
  // keyFn: (opts) => myKey  // optional custom cache key function
});

const r1 = await cachedGenerate({ client, model, schema, prompt: "same question" });
const r2 = await cachedGenerate({ client, model, schema, prompt: "same question" });

console.log(r1.fromCache); // false — hit the API
console.log(r2.fromCache); // true — served from cache, no API call

// Use a shared store across multiple withCache instances
import { createCacheStore } from "structured-llm";
const store = createCacheStore();
const cachedA = withCache({ store, ttl: 60_000 });
const cachedB = withCache({ store, ttl: 60_000 });
```

---

## Providers

The library auto-detects the provider from your client instance. Just pass it in.

### Native providers

| Provider | Install | Client class |
|---|---|---|
| OpenAI | `npm i openai` | `new OpenAI()` |
| Anthropic | `npm i @anthropic-ai/sdk` | `new Anthropic()` |
| Gemini | `npm i @google/genai` | `new GoogleGenAI({ apiKey })` |
| Mistral | `npm i @mistralai/mistralai` | `new Mistral({ apiKey })` |
| Cohere | `npm i cohere-ai` | `new CohereClient({ token })` |

### OpenAI-compatible providers

These all use the OpenAI SDK pointed at a different endpoint. The library detects them by `baseURL`:

```typescript
import OpenAI from "openai";

// Groq — fastest inference, great for real-time apps
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});
generate({ client: groq, model: "llama-3.3-70b-versatile", ... })

// xAI (Grok)
const xai = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
});
generate({ client: xai, model: "grok-2", ... })

// Together AI — large selection of open models
const together = new OpenAI({
  apiKey: process.env.TOGETHER_API_KEY,
  baseURL: "https://api.together.xyz/v1",
});
generate({ client: together, model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", ... })

// Fireworks AI — fast open model inference
const fireworks = new OpenAI({
  apiKey: process.env.FIREWORKS_API_KEY,
  baseURL: "https://api.fireworks.ai/inference/v1",
});

// Perplexity
const perplexity = new OpenAI({
  apiKey: process.env.PERPLEXITY_API_KEY,
  baseURL: "https://api.perplexity.ai",
});

// Ollama — local models, completely free
const ollama = new OpenAI({
  apiKey: "ollama",
  baseURL: "http://localhost:11434/v1",
});
generate({ client: ollama, model: "llama3.2", mode: "json-mode" })

// Azure OpenAI
const azure = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: "https://your-resource.openai.azure.com/openai/deployments/gpt-4o",
});
```

### Auto-initialize from environment

Skip client creation entirely — pass a `provider` string and the library reads from env:

```typescript
generate({
  provider: "openai",     // OPENAI_API_KEY
  provider: "anthropic",  // ANTHROPIC_API_KEY
  provider: "gemini",     // GEMINI_API_KEY
  provider: "mistral",    // MISTRAL_API_KEY
  provider: "groq",       // GROQ_API_KEY
  provider: "xai",        // XAI_API_KEY
  provider: "together",   // TOGETHER_API_KEY
  provider: "fireworks",  // FIREWORKS_API_KEY
  provider: "perplexity", // PERPLEXITY_API_KEY
  provider: "cohere",     // COHERE_API_KEY
  provider: "ollama",     // no key needed
  model: "...",
  schema: ...,
  prompt: "...",
})
```

---

## Extraction modes

The library automatically picks the best extraction mode based on the model's capabilities. You can also set it explicitly.

| Mode | How it works | Reliability |
|---|---|---|
| `tool-calling` | Schema becomes a tool definition. LLM is forced to "call" it, guaranteeing JSON. | Highest |
| `json-mode` | Sets `response_format: json_object`. Schema embedded in system prompt. | High |
| `prompt-inject` | Schema appended to user prompt. JSON extracted from response with fallback parsing. | Good |

**Auto-selection logic:**

```
Does the model support tool calling?
  YES → tool-calling  (GPT-4o, Claude 3+, Gemini 1.5+, Mistral Large, Groq)
  NO
    Does the model support JSON mode?
      YES → json-mode  (GPT-3.5, Gemini Flash, Perplexity, most modern models)
      NO  → prompt-inject  (works on any model, including Ollama local models)
```

Override when needed:

```typescript
// Force JSON mode even if the model supports tool calling
generate({ ..., mode: "json-mode" })

// Prompt injection — works even on models with no structured output support
generate({ ..., mode: "prompt-inject" })
```

---

## Retry logic

On invalid JSON or schema validation failure, the library retries automatically. Each retry includes the validation errors so the LLM can fix its own output.

```
Attempt 1:  LLM returns { "score": 1.8, "sentiment": "mixed" }
            → validation fails: score must be ≤ 1, sentiment must be "positive"|"negative"|"neutral"

Attempt 2:  "Your previous response had errors:
             - score: Number must be less than or equal to 1
             - sentiment: Invalid enum value
            Please fix and respond with corrected JSON."
            → LLM returns { "score": 0.8, "sentiment": "positive" }  ✓
```

```typescript
generate({
  ...,
  maxRetries: 3,          // default: 3 (set 0 to disable)
  retryOptions: {
    strategy: "exponential",   // "immediate" (default) | "linear" | "exponential"
    baseDelayMs: 500,          // base delay for linear/exponential strategies
  },
})
```

---

## Fallback chain

Define a list of provider+model pairs to try in order. Falls back automatically if the primary provider fails (network error, rate limit, etc.). Does **not** fall back on validation errors — those are retried against the same provider.

```typescript
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

generate({
  // primary
  client: new OpenAI(),
  model: "gpt-4o",

  fallbackChain: [
    // first fallback — different model, same provider
    { client: new OpenAI(), model: "gpt-4o-mini" },

    // second fallback — different provider
    { client: new Anthropic(), model: "claude-haiku-4-5" },

    // last resort — free local model
    { provider: "ollama", model: "llama3.2" },
  ],

  schema: ...,
  prompt: "...",
  hooks: {
    onError: ({ error }) => console.log("Primary failed, trying fallback:", error.message),
  },
})
```

---

## Usage tracking

Pass `trackUsage: true` to get token counts and a cost estimate back with every call.

```typescript
const { data, usage } = await generate({
  ...,
  trackUsage: true,
});

console.log(usage);
// {
//   promptTokens: 312,
//   completionTokens: 95,
//   totalTokens: 407,
//   estimatedCostUsd: 0.0000891,    // based on published pricing
//   latencyMs: 843,
//   attempts: 1,
//   model: "gpt-4o-mini",
//   provider: "openai",
// }
```

The cost estimate uses a built-in pricing table that's updated with each release. It covers all 35+ supported models. For unknown models, `estimatedCostUsd` is `0`.

Use the `onSuccess` hook to pipe usage data to your analytics or database:

```typescript
createClient({
  ...,
  defaultOptions: {
    trackUsage: true,
    hooks: {
      onSuccess: ({ usage }) => {
        myAnalytics.record({
          model: usage?.model,
          tokens: usage?.totalTokens,
          cost: usage?.estimatedCostUsd,
          latency: usage?.latencyMs,
        });
      },
    },
  },
})
```

---

## Hooks

Hooks run at each stage of the request lifecycle. Useful for logging, metrics, cost tracking, and debugging.

```typescript
generate({
  ...,
  hooks: {
    // Fires before each LLM request (including retries)
    onRequest: ({ messages, model, provider, attempt }) => {
      logger.debug("LLM request", { model, provider, attempt, messageCount: messages.length });
    },

    // Fires when the LLM responds (before parsing/validation)
    onResponse: ({ rawResponse, attempt, model }) => {
      // useful for debugging what the LLM actually returned
    },

    // Fires when a retry is about to happen
    onRetry: ({ attempt, maxRetries, error, model }) => {
      logger.warn(`Retrying (${attempt}/${maxRetries}): ${error}`);
    },

    // Fires when the final result passes validation
    onSuccess: ({ result, usage }) => {
      metrics.increment("llm.success", { model: usage?.model });
    },

    // Fires when all attempts fail
    onError: ({ error, allAttempts }) => {
      logger.error("LLM extraction failed", { error: error.message, attempts: allAttempts });
      alerting.send("LLM failure", error);
    },
  },
})
```

When using `createClient`, global hooks (set on the client) and per-call hooks are both called — you don't have to choose.

```typescript
const llm = createClient({
  ...,
  defaultOptions: {
    hooks: { onSuccess: globalMetrics },   // always runs
  },
});

llm.generate({
  ...,
  hooks: { onSuccess: localLog },          // also runs, in addition to globalMetrics
});
```

---

## Error handling

All errors extend `StructuredLLMError` so you can catch them broadly or specifically.

```typescript
import {
  StructuredLLMError,   // base class
  ValidationError,      // schema validation failed after all retries
  ParseError,           // LLM returned non-JSON after all retries
  ProviderError,        // upstream API error (rate limit, auth, network)
  MaxRetriesError,      // exceeded maxRetries (shouldn't normally see this)
  SchemaError,          // invalid schema passed in
  MissingInputError,    // no prompt or messages provided
} from "structured-llm";

try {
  const { data } = await generate({ ... });
} catch (err) {
  if (err instanceof ValidationError) {
    // The LLM consistently returned data that didn't match your schema
    console.log(err.issues);        // array of validation error strings
    console.log(err.lastResponse);  // the raw JSON string the LLM returned
    console.log(err.attempts);      // how many times it tried (maxRetries + 1)
  }

  if (err instanceof ParseError) {
    // The LLM kept returning non-JSON (rare with tool-calling mode)
    console.log(err.lastResponse);
  }

  if (err instanceof ProviderError) {
    // The provider API returned an error
    console.log(err.provider);      // "openai"
    console.log(err.statusCode);    // 429 (rate limit), 401 (auth), etc.
    console.log(err.originalError); // the raw error from the SDK
  }

  if (err instanceof StructuredLLMError) {
    // catch-all for any structured-llm error
  }
}
```

---

## Custom schemas (no Zod)

You don't have to use Zod. Any object with a `jsonSchema` and `parse` function works.

```typescript
// With TypeBox
import { Type, type Static } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

const UserSchema = Type.Object({
  name: Type.String(),
  age: Type.Number({ minimum: 0 }),
  role: Type.Union([Type.Literal("admin"), Type.Literal("user")]),
});
type User = Static<typeof UserSchema>;

const compiled = TypeCompiler.Compile(UserSchema);

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: {
    jsonSchema: UserSchema,
    parse: (input: unknown): User => {
      const errors = [...compiled.Errors(input)];
      if (errors.length) throw new Error(errors.map((e) => e.message).join(", "));
      return input as User;
    },
  },
  prompt: "...",
});
```

```typescript
// Hand-rolled validator
const { data } = await generate({
  ...,
  schema: {
    jsonSchema: {
      type: "object",
      properties: {
        score: { type: "number", minimum: 0, maximum: 1 },
        label: { type: "string", enum: ["spam", "ham"] },
      },
      required: ["score", "label"],
    },
    parse: (input) => {
      const d = input as { score: number; label: string };
      if (d.score < 0 || d.score > 1) throw new Error("score out of range");
      if (!["spam", "ham"].includes(d.label)) throw new Error("invalid label");
      return d;
    },
  },
});
```

---

## Framework integrations

### Next.js App Router

```typescript
// app/api/analyze/route.ts
import { structuredRoute } from "structured-llm/next";
import { z } from "zod";

export const POST = structuredRoute({
  provider: "openai",
  model: "gpt-4o-mini",
  schema: z.object({
    category: z.enum(["bug", "feature", "question"]),
    priority: z.enum(["low", "medium", "high"]),
    summary: z.string(),
  }),
});

// Request:  POST /api/analyze  { "prompt": "App crashes on login" }
// Response: { "data": { "category": "bug", "priority": "high", "summary": "..." } }
```

```typescript
// As a server action
import { withStructured } from "structured-llm/next";

export const classifyTicket = withStructured({
  provider: "openai",
  model: "gpt-4o-mini",
  schema: TicketSchema,
});

// In your component or another server action:
const result = await classifyTicket({ prompt: ticket.description });
```

### Hono

```typescript
import { Hono } from "hono";
import { structuredLLM } from "structured-llm/hono";
import { z } from "zod";

const app = new Hono();

app.post(
  "/extract",
  structuredLLM({
    provider: "openai",
    model: "gpt-4o-mini",
    schema: z.object({ name: z.string(), email: z.string().email() }),
    promptFromBody: (body) => `Extract contact info from: ${body.text}`,
  }),
  (c) => {
    const result = c.get("structuredResult");
    return c.json({ data: result });
  }
);
```

### Express

```typescript
import express from "express";
import { structuredMiddleware } from "structured-llm/express";
import { z } from "zod";

const app = express();
app.use(express.json());

app.post(
  "/classify",
  structuredMiddleware({
    provider: "openai",
    model: "gpt-4o-mini",
    schema: z.object({
      intent: z.enum(["purchase", "refund", "inquiry", "complaint"]),
      confidence: z.number(),
    }),
    promptFromBody: (body) => body.message,
  }),
  (req, res) => {
    res.json(req.structured); // { intent: "refund", confidence: 0.94 }
  }
);
```

---

## Model utilities

```typescript
import { getModelCapabilities, listSupportedModels } from "structured-llm";

// check a specific model
const caps = getModelCapabilities("gpt-4o-mini");
// {
//   provider: "openai",
//   toolCalling: true,
//   jsonMode: true,
//   streaming: true,
//   contextWindow: 128000,
//   inputCostPer1M: 0.15,
//   outputCostPer1M: 0.6
// }

// list all supported models for a provider
listSupportedModels({ provider: "groq" });
// ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768", ...]

// list everything
listSupportedModels();
// all 35+ registered models
```

---

## Examples

The [`examples/`](examples/) directory has 40 full runnable examples covering a wide range of use cases:

```bash
# clone the repo
git clone https://github.com/piyushgupta344/structured-llm
cd structured-llm && pnpm install

OPENAI_API_KEY=sk-... npx tsx examples/01-sentiment-analysis.ts
```

**Core library features:**

| Example | What it demonstrates |
|---|---|
| [`01-sentiment-analysis.ts`](examples/01-sentiment-analysis.ts) | Batch sentiment scoring with confidence intervals |
| [`02-data-extraction.ts`](examples/02-data-extraction.ts) | Parse meeting notes into structured agenda / action items |
| [`03-multi-provider.ts`](examples/03-multi-provider.ts) | Run the same extraction across OpenAI, Anthropic, Gemini |
| [`04-fallback-chain.ts`](examples/04-fallback-chain.ts) | Automatic fallback when primary provider is unavailable |
| [`05-streaming.ts`](examples/05-streaming.ts) | Real-time partial updates while generating a long report |
| [`06-generate-array.ts`](examples/06-generate-array.ts) | Parse a bank statement into typed transaction objects |
| [`07-create-client.ts`](examples/07-create-client.ts) | Reusable client for an email triage pipeline |
| [`08-custom-schema.ts`](examples/08-custom-schema.ts) | Bring your own validator instead of Zod |
| [`09-fintech-analysis.ts`](examples/09-fintech-analysis.ts) | Parse earnings call transcripts and classify headlines |
| [`10-ollama-local.ts`](examples/10-ollama-local.ts) | Run everything locally with Ollama — zero API cost |

**Document processing:**

| Example | What it demonstrates |
|---|---|
| [`11-resume-parsing.ts`](examples/11-resume-parsing.ts) | Extract skills, experience, and education from a CV |
| [`12-invoice-extraction.ts`](examples/12-invoice-extraction.ts) | `extract()` helper — parse billing data from invoice text |
| [`15-legal-contract-analysis.ts`](examples/15-legal-contract-analysis.ts) | `generateMultiSchema()` — key terms + risk assessment from one document |
| [`18-medical-notes-extraction.ts`](examples/18-medical-notes-extraction.ts) | Extract vitals, symptoms, medications from clinical notes |
| [`21-news-fact-extraction.ts`](examples/21-news-fact-extraction.ts) | Entities, key claims, and tone analysis from news articles |
| [`24-email-thread-analysis.ts`](examples/24-email-thread-analysis.ts) | Action items, decisions, and sentiment from email threads |
| [`28-academic-paper-analysis.ts`](examples/28-academic-paper-analysis.ts) | `generateMultiSchema()` — metadata + contributions from research papers |
| [`31-podcast-show-notes.ts`](examples/31-podcast-show-notes.ts) | Chapters, quotes, and resources from podcast transcripts |

**Classification & routing:**

| Example | What it demonstrates |
|---|---|
| [`13-content-moderation.ts`](examples/13-content-moderation.ts) | Multi-category content safety scoring |
| [`14-support-ticket-routing.ts`](examples/14-support-ticket-routing.ts) | `classify()` — route tickets to the right team with confidence |
| [`34-multilingual-feedback.ts`](examples/34-multilingual-feedback.ts) | `generateBatch()` — detect language, translate, and classify in bulk |
| [`38-bug-triage.ts`](examples/38-bug-triage.ts) | `generateBatch()` — severity, priority, and owner assignment |

**Code & developer tooling:**

| Example | What it demonstrates |
|---|---|
| [`16-code-security-audit.ts`](examples/16-code-security-audit.ts) | Detect OWASP vulnerabilities and generate secure rewrites |
| [`20-git-commit-generator.ts`](examples/20-git-commit-generator.ts) | `createTemplate()` — conventional commits from git diffs |
| [`23-natural-language-to-sql.ts`](examples/23-natural-language-to-sql.ts) | `createTemplate()` — parameterized SQL from plain English |
| [`25-api-spec-extraction.ts`](examples/25-api-spec-extraction.ts) | Generate OpenAPI-style specs from natural language descriptions |
| [`36-test-generation.ts`](examples/36-test-generation.ts) | Unit test generation from function signatures |

**Business intelligence:**

| Example | What it demonstrates |
|---|---|
| [`19-job-posting-skills.ts`](examples/19-job-posting-skills.ts) | Tech stack and requirements from job descriptions |
| [`26-sales-call-crm.ts`](examples/26-sales-call-crm.ts) | CRM-ready data from sales call transcripts |
| [`33-competitor-analysis.ts`](examples/33-competitor-analysis.ts) | `generateBatch()` — competitive intelligence at scale |
| [`40-market-research-template.ts`](examples/40-market-research-template.ts) | `createTemplate()` — run the same research framework across multiple markets |

**Data pipelines & real-world use cases:**

| Example | What it demonstrates |
|---|---|
| [`17-product-catalog-normalization.ts`](examples/17-product-catalog-normalization.ts) | `generateBatch()` — normalize messy product data from multiple suppliers |
| [`22-recipe-extraction.ts`](examples/22-recipe-extraction.ts) | Parse blog-style recipe posts into structured cooking data |
| [`27-log-anomaly-detection.ts`](examples/27-log-anomaly-detection.ts) | Analyze server logs for incidents and root causes |
| [`29-real-estate-listing.ts`](examples/29-real-estate-listing.ts) | `generateArray()` — parse multiple property listings at once |
| [`30-symptom-triage.ts`](examples/30-symptom-triage.ts) | Urgency classification from symptom descriptions |
| [`32-review-aggregation.ts`](examples/32-review-aggregation.ts) | Parse then aggregate product reviews into insights |
| [`35-event-calendar-extraction.ts`](examples/35-event-calendar-extraction.ts) | `generateArray()` — parse event announcements into calendar objects |
| [`37-caching-repeated-queries.ts`](examples/37-caching-repeated-queries.ts) | `withCache()` — avoid redundant API calls for identical inputs |
| [`39-multi-schema-document.ts`](examples/39-multi-schema-document.ts) | `generateMultiSchema()` — summary + quotes + actions from one document |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get started, what kind of PRs are accepted, and how to add a new provider.

---

## License

[MIT](LICENSE)
