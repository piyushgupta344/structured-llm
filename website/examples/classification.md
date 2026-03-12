# Classification

Use `classify()` to route inputs into predefined categories, or use `generate()` for custom scoring logic.

## Basic classification with classify()

```typescript
import { classify } from "structured-llm";

const { label, confidence } = await classify({
  client: openai,
  model: "gpt-4o-mini",
  prompt: "My order hasn't arrived after 3 weeks and I'm very frustrated",
  options: ["billing", "shipping", "returns", "technical", "other"],
});

console.log(label);      // "shipping"
console.log(confidence); // 0.92
```

## Support ticket routing

Route incoming support tickets to the right team:

```typescript
import { classify } from "structured-llm";

const DEPARTMENTS = [
  "billing",
  "shipping",
  "returns",
  "technical-support",
  "account",
  "other",
] as const;

async function routeTicket(ticketText: string) {
  const { label, confidence, reasoning } = await classify({
    client: openai,
    model: "gpt-4o-mini",
    prompt: ticketText,
    options: [...DEPARTMENTS],
    systemPrompt: "You are a customer support routing assistant. Classify tickets into the most appropriate department.",
  });

  if (confidence < 0.6) {
    // Low confidence → escalate to human review
    await escalateToHuman(ticketText, label, confidence);
  } else {
    await assignToDepartment(ticketText, label);
  }

  return { department: label, confidence, reasoning };
}
```

## Multi-category safety scoring

Score content across several safety dimensions at once:

```typescript
import { z } from "zod";
import { generate } from "structured-llm";

const SafetySchema = z.object({
  overallSafe: z.boolean(),
  scores: z.object({
    violence: z.number().min(0).max(1),
    hateSpeech: z.number().min(0).max(1),
    adultContent: z.number().min(0).max(1),
    selfHarm: z.number().min(0).max(1),
    spam: z.number().min(0).max(1),
  }),
  flags: z.array(z.string()),
  action: z.enum(["allow", "warn", "block", "review"]),
});

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: SafetySchema,
  systemPrompt: "You are a content safety classifier. Score content objectively.",
  prompt: `Evaluate this user-submitted content:\n\n${userContent}`,
  temperature: 0,
});

if (data.action === "block") {
  return { blocked: true, reason: data.flags.join(", ") };
}
```

## Batch classification

Classify many items in parallel:

```typescript
import { generateBatch } from "structured-llm";
import { z } from "zod";

const SentimentSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral", "mixed"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
});

const reviews = await loadReviews(); // array of strings

const { succeeded, failed } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: SentimentSchema,
  inputs: reviews.map((review) => ({
    prompt: `Classify the sentiment of this product review:\n\n"${review}"`,
  })),
  concurrency: 10,
  onProgress: ({ completed, total }) => {
    process.stdout.write(`\r${completed}/${total}`);
  },
});

const distribution = succeeded.reduce(
  (acc, item) => {
    const s = item.data?.sentiment ?? "unknown";
    acc[s] = (acc[s] ?? 0) + 1;
    return acc;
  },
  {} as Record<string, number>
);

console.log("Sentiment distribution:", distribution);
```

## Intent detection for chatbots

Detect user intent before routing to the right handler:

```typescript
import { z } from "zod";
import { generate } from "structured-llm";

const IntentSchema = z.object({
  intent: z.enum([
    "book_appointment",
    "cancel_appointment",
    "check_status",
    "billing_question",
    "general_question",
    "complaint",
  ]),
  entities: z.object({
    date: z.string().optional(),
    service: z.string().optional(),
    orderId: z.string().optional(),
  }),
  urgency: z.enum(["low", "medium", "high"]),
  requiresHuman: z.boolean(),
});

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: IntentSchema,
  systemPrompt: "You are an intent classifier for a customer service chatbot.",
  messages: conversationHistory,
  temperature: 0,
});

switch (data.intent) {
  case "book_appointment":
    return handleBooking(data.entities);
  case "complaint":
    if (data.urgency === "high" || data.requiresHuman) {
      return escalateToHuman();
    }
    break;
}
```

## Multilingual classification

classify() works in any language — just pass the text as-is:

```typescript
const tickets = [
  { id: 1, text: "Meine Bestellung ist nicht angekommen." },  // German
  { id: 2, text: "El producto llegó dañado." },               // Spanish
  { id: 3, text: "配送が遅れています。" },                        // Japanese
];

const results = await Promise.all(
  tickets.map(async (ticket) => {
    const { label, confidence } = await classify({
      client: openai,
      model: "gpt-4o-mini",
      prompt: ticket.text,
      options: ["shipping", "damage", "billing", "other"],
    });
    return { ...ticket, label, confidence };
  })
);
```
