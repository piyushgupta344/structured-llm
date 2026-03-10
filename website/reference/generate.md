# generate()

Extract a single structured object from any LLM.

```typescript
import { generate } from "structured-llm";

const { data, usage } = await generate(options);
```

## Options

```typescript
interface GenerateOptions<TSchema> {
  // Provider — pass one of these
  client?: OpenAI | Anthropic | GoogleGenAI | Mistral | CohereClient;
  provider?: "openai" | "anthropic" | "gemini" | "mistral" | "cohere"
           | "groq" | "xai" | "together" | "fireworks" | "perplexity"
           | "ollama" | "azure-openai";
  apiKey?: string;   // used with provider string, overrides env var
  baseURL?: string;  // custom endpoint

  // Required
  model: string;
  schema: ZodSchema | CustomSchema;

  // Input — at least one required
  prompt?: string;
  messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  systemPrompt?: string;  // shorthand for a system message

  // Extraction
  mode?: "auto" | "tool-calling" | "json-mode" | "prompt-inject";

  // Retry
  maxRetries?: number;           // default: 3
  retryOptions?: {
    strategy?: "immediate" | "linear" | "exponential";  // default: "immediate"
    baseDelayMs?: number;        // default: 500
  };

  // Generation
  temperature?: number;
  maxTokens?: number;

  // Observability
  trackUsage?: boolean;          // default: false
  hooks?: Hooks;

  // Fallback
  fallbackChain?: FallbackEntry[];
}
```

## Return value

```typescript
interface GenerateResult<T> {
  data: T;                   // validated, fully typed
  usage?: UsageInfo;         // only present if trackUsage: true
}

interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}
```

## Examples

### Basic usage

```typescript
const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: z.object({
    name: z.string(),
    age: z.number().int(),
    email: z.string().email(),
  }),
  prompt: "Extract user info: Alice Smith, 28, alice@example.com",
});

console.log(data.name);  // "Alice Smith"
console.log(data.age);   // 28
```

### With usage tracking

```typescript
const { data, usage } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: MySchema,
  prompt: "...",
  trackUsage: true,
});

console.log(usage?.totalTokens);      // 342
console.log(usage?.estimatedCostUsd); // 0.0000513
```

### With retry strategy

```typescript
const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: StrictSchema,
  prompt: "...",
  maxRetries: 5,
  retryOptions: {
    strategy: "exponential",
    baseDelayMs: 300,
  },
});
```

### Using messages instead of prompt

```typescript
const { data } = await generate({
  client: anthropic,
  model: "claude-haiku-4-5",
  schema: MySchema,
  messages: [
    { role: "user", content: "Analyze this document:" },
    { role: "assistant", content: "I'll extract the key information." },
    { role: "user", content: documentText },
  ],
});
```

### Force a specific extraction mode

```typescript
// Tool calling is default — force JSON mode
generate({ ..., mode: "json-mode" })

// Works on any model including local Ollama
generate({ ..., mode: "prompt-inject" })
```

## Errors

| Error class | When it's thrown |
|---|---|
| `ValidationError` | Schema validation failed after all retries |
| `ParseError` | Response couldn't be parsed as JSON |
| `ProviderError` | API error from the LLM provider |
| `MaxRetriesError` | Exceeded max retry count |
| `MissingInputError` | Neither `prompt` nor `messages` was provided |

```typescript
import { ValidationError, ProviderError } from "structured-llm";

try {
  const { data } = await generate({ ... });
} catch (err) {
  if (err instanceof ValidationError) {
    console.log("Failed after", err.attempts, "attempts");
    console.log("Last response:", err.lastResponse);
    console.log("Issues:", err.issues);
  }
  if (err instanceof ProviderError) {
    console.log("Provider:", err.provider);
    console.log("Status:", err.statusCode);
  }
}
```
