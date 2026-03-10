# Retry Logic

When an LLM returns bad JSON or data that fails validation, structured-llm retries automatically — and sends the validation errors back to the model so it can fix its own output.

## How it works

```
Attempt 1:
  → send prompt to LLM
  ← LLM returns: { "score": 1.8, "sentiment": "mixed" }
  → validation fails:
      - score: Number must be ≤ 1
      - sentiment: Invalid enum value (expected "positive" | "negative" | "neutral")

Attempt 2:
  → send original prompt + error context:
      "Your previous response had validation errors:
       - score: Number must be less than or equal to 1
       - sentiment: Invalid enum value. Expected 'positive' | 'negative' | 'neutral'
      Previous response: {"score": 1.8, "sentiment": "mixed"}
      Please fix these errors and respond with corrected JSON."
  ← LLM returns: { "score": 0.8, "sentiment": "positive" }
  → validation passes ✓
```

The error feedback loop means the model almost always corrects itself on the second attempt.

## Configuration

```typescript
generate({
  // ...
  maxRetries: 3,          // default: 3. Set 0 to disable retries entirely.
  retryOptions: {
    strategy: "immediate",    // default — retry immediately
    // strategy: "linear",    // wait baseDelayMs * attempt
    // strategy: "exponential" // wait baseDelayMs * 2^attempt
    baseDelayMs: 500,         // base delay for linear/exponential
  },
});
```

## What triggers a retry

| Situation | Retried? | Notes |
|---|---|---|
| Response isn't valid JSON | yes | Extraction attempted with fallback parser first |
| Response fails Zod validation | yes | Errors sent back as feedback |
| Provider API error (5xx) | no | Moves to fallback chain |
| Rate limit (429) | no | Moves to fallback chain |
| Network timeout | no | Moves to fallback chain |

## The retry hook

You can observe retries with the `onRetry` hook:

```typescript
generate({
  // ...
  hooks: {
    onRetry: ({ attempt, maxRetries, error }) => {
      console.log(`Retry ${attempt}/${maxRetries}: ${error.message}`);
    },
  },
});
```

## When retries still fail

If validation fails after all retries, a `ValidationError` is thrown:

```typescript
import { ValidationError } from "structured-llm";

try {
  const { data } = await generate({ ..., maxRetries: 3 });
} catch (err) {
  if (err instanceof ValidationError) {
    console.log("Gave up after", err.attempts, "attempts");
    console.log("Last response:", err.lastResponse);  // the raw string
    console.log("Zod issues:", err.issues);
  }
}
```
