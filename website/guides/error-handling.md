# Error Handling

structured-llm throws typed errors so you can handle specific failure modes cleanly.

## Error classes

```typescript
import {
  StructuredLLMError,  // base class for all errors
  ValidationError,     // schema validation failed after all retries
  ParseError,          // response couldn't be parsed as JSON
  ProviderError,       // API error from the LLM provider
  MaxRetriesError,     // exceeded max retry count
  SchemaError,         // invalid or unsupported schema
  MissingInputError,   // neither prompt nor messages was provided
  UnsupportedProviderError, // unknown provider name
} from "structured-llm";
```

## ValidationError

Thrown when the LLM returns data that fails your Zod schema, even after all retry attempts.

```typescript
import { ValidationError } from "structured-llm";

try {
  const { data } = await generate({
    client: openai,
    model: "gpt-4o-mini",
    schema: StrictSchema,
    prompt: "...",
    maxRetries: 3,
  });
} catch (err) {
  if (err instanceof ValidationError) {
    console.log("Failed after", err.attempts, "attempts");
    console.log("Last raw response:", err.lastResponse);
    console.log("Validation issues:", err.issues);
    // err.issues is string[] — human-readable Zod error messages
  }
}
```

**Common causes:**
- Schema is too strict for the model to satisfy reliably
- Prompt doesn't give the model enough context to produce valid data
- Model isn't capable enough for the schema complexity

**Fixes:**
- Add `.describe()` hints to Zod fields
- Loosen constraints (e.g. `.optional()` for fields that may not always be present)
- Use a more capable model
- Increase `maxRetries`

## ParseError

Thrown when the LLM response can't be parsed as JSON at all.

```typescript
import { ParseError } from "structured-llm";

try {
  const { data } = await generate({ ... });
} catch (err) {
  if (err instanceof ParseError) {
    console.log("Raw response:", err.rawResponse);
    console.log("Attempt number:", err.attempt);
  }
}
```

**Common causes:**
- Model is outputting markdown or prose instead of JSON
- Using `prompt-inject` mode with a model that doesn't follow instructions well
- Response was truncated due to `maxTokens` being too low

**Fixes:**
- Increase `maxTokens`
- Switch to `tool-calling` or `json-mode`
- Add explicit instructions: `"Respond with ONLY valid JSON. No explanation."`

## ProviderError

Thrown when the LLM provider returns an API error.

```typescript
import { ProviderError } from "structured-llm";

try {
  const { data } = await generate({ ... });
} catch (err) {
  if (err instanceof ProviderError) {
    console.log("Provider:", err.provider);     // "openai" | "anthropic" | etc.
    console.log("Status:", err.statusCode);     // HTTP status code
    console.log("Message:", err.message);       // provider error message

    if (err.statusCode === 429) {
      console.log("Rate limited — try again later");
    } else if (err.statusCode === 401) {
      console.log("Invalid API key");
    }
  }
}
```

structured-llm automatically retries on 429, 502, 503, and 529 with exponential backoff before throwing.

## MissingInputError

Thrown synchronously when neither `prompt` nor `messages` is provided.

```typescript
import { MissingInputError } from "structured-llm";

try {
  const { data } = await generate({
    client: openai,
    model: "gpt-4o-mini",
    schema: Schema,
    // prompt is missing — this throws immediately
  });
} catch (err) {
  if (err instanceof MissingInputError) {
    console.log("Bug: forgot to pass prompt or messages");
  }
}
```

## Handling all errors

```typescript
import {
  ValidationError,
  ParseError,
  ProviderError,
  MissingInputError,
  StructuredLLMError,
} from "structured-llm";

async function safeGenerate(prompt: string) {
  try {
    return await generate({ client: openai, model: "gpt-4o-mini", schema: Schema, prompt });
  } catch (err) {
    if (err instanceof ValidationError) {
      // Recoverable — retry with better prompt or relaxed schema
      logger.warn("Validation failed", { issues: err.issues, attempts: err.attempts });
      return null;
    }
    if (err instanceof ProviderError && err.statusCode === 429) {
      // Rate limited — surface to caller to retry later
      throw new Error("Service temporarily unavailable — please try again");
    }
    if (err instanceof StructuredLLMError) {
      // Other known error — log and fail gracefully
      logger.error("LLM error", { type: err.constructor.name, message: err.message });
      return null;
    }
    // Unknown error — rethrow
    throw err;
  }
}
```

## Using the onError hook

Observe errors without wrapping every call in try/catch:

```typescript
const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    hooks: {
      onError: ({ error, allAttempts }) => {
        Sentry.captureException(error, {
          extra: { attempts: allAttempts, errorType: error.constructor.name },
        });
      },
    },
  },
});
```

## Fallback chain for resilience

Use a fallback chain to automatically switch providers when one fails:

```typescript
const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: Schema,
  prompt: "...",
  fallbackChain: [
    { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],
});
// If OpenAI fails, tries Anthropic, then Gemini
```

See [Fallback Chain](/concepts/fallback) for more.

## Error reference

| Error | When thrown | Key properties |
|---|---|---|
| `ValidationError` | Schema validation failed after all retries | `issues`, `lastResponse`, `attempts` |
| `ParseError` | Response isn't valid JSON | `rawResponse`, `attempt` |
| `ProviderError` | Provider API returned an error | `provider`, `statusCode` |
| `MaxRetriesError` | Retry limit exceeded (internal) | `attempts` |
| `SchemaError` | Schema is invalid or unsupported | — |
| `MissingInputError` | No `prompt` or `messages` provided | — |
| `UnsupportedProviderError` | Unknown `provider` string | `provider` |
