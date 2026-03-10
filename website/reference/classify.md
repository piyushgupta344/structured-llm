# classify()

Classify text into one or more predefined categories. No Zod schema required.

```typescript
import { classify } from "structured-llm";

const result = await classify(options);
```

## Options

```typescript
interface ClassifyOptions {
  // Provider (same as generate())
  client?: ...; provider?: ...; model: string;

  // Input
  prompt?: string;
  messages?: Message[];
  systemPrompt?: string;

  // Classification config
  options: Array<string | { value: string; description?: string }>;
  allowMultiple?: boolean;       // default: false — multi-label classification
  includeConfidence?: boolean;   // default: false — 0–1 confidence score
  includeReasoning?: boolean;    // default: false — one sentence explanation
}
```

## Return value

```typescript
interface ClassifyResult {
  label: string;          // top label (first of labels[] for multi-label)
  labels: string[];       // always an array — convenient for single and multi
  confidence?: number;    // 0–1, only if includeConfidence: true
  reasoning?: string;     // only if includeReasoning: true
}
```

## Examples

### Single-label classification

```typescript
const { label } = await classify({
  client: openai,
  model: "gpt-4o-mini",
  prompt: "Can't log into my account after resetting password.",
  options: ["auth", "billing", "bug", "feature-request", "general"],
});

console.log(label); // "auth"
```

### With confidence and reasoning

```typescript
const { label, confidence, reasoning } = await classify({
  client: openai,
  model: "gpt-4o-mini",
  prompt: "The dashboard loads in 30+ seconds.",
  options: ["bug", "performance", "feature-request"],
  includeConfidence: true,
  includeReasoning: true,
});

// label: "performance"
// confidence: 0.91
// reasoning: "User reports slow loading time, indicating a performance issue."
```

### Options with descriptions

Descriptions help the model understand what each category means:

```typescript
const { label } = await classify({
  client: openai,
  model: "gpt-4o-mini",
  prompt: reviewText,
  options: [
    { value: "positive", description: "Clearly satisfied, would recommend" },
    { value: "neutral", description: "Mixed feelings or indifferent" },
    { value: "negative", description: "Dissatisfied, would not recommend" },
  ],
});
```

### Multi-label classification

```typescript
const { labels } = await classify({
  client: openai,
  model: "gpt-4o-mini",
  prompt: "URGENT: I can't log in and I was charged $200 I didn't authorize.",
  options: ["billing", "auth", "urgent", "fraud"],
  allowMultiple: true,
});

// labels: ["billing", "auth", "urgent", "fraud"]
```
