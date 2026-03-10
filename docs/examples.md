# Examples

Detailed walkthroughs of the included examples. All examples are in the [`examples/`](../examples/) directory and can be run directly.

```bash
# Prerequisites
git clone https://github.com/piyushgupta344/structured-llm
cd structured-llm && pnpm install

# Run any example
OPENAI_API_KEY=sk-... npx tsx examples/01-sentiment-analysis.ts
```

---

## 01 — Sentiment analysis

**File:** [`examples/01-sentiment-analysis.ts`](../examples/01-sentiment-analysis.ts)

Analyzes product reviews and returns structured sentiment data with scores, confidence, and keywords.

```typescript
const SentimentSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(-1).max(1),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  keywords: z.array(z.string()),
});
```

What it demonstrates:
- Basic `generate()` usage
- Using `trackUsage` to monitor costs
- Using the `onRetry` hook for logging
- Batch processing multiple inputs

---

## 02 — Data extraction from unstructured text

**File:** [`examples/02-data-extraction.ts`](../examples/02-data-extraction.ts)

Parses a block of meeting notes into a fully structured object with attendees, agenda items, action items, and decisions.

```typescript
const MeetingSchema = z.object({
  title: z.string(),
  date: z.string(),
  attendees: z.array(z.object({ name: z.string(), email: z.string().optional() })),
  agenda: z.array(z.string()),
  actionItems: z.array(z.object({
    task: z.string(),
    owner: z.string().optional(),
    dueDate: z.string().optional(),
  })),
  decisions: z.array(z.string()),
});
```

What it demonstrates:
- Deeply nested schemas
- Optional fields in nested objects
- Setting `temperature: 0` for deterministic extraction
- Real-world document parsing use case

---

## 03 — Multi-provider comparison

**File:** [`examples/03-multi-provider.ts`](../examples/03-multi-provider.ts)

Runs the same recipe extraction against OpenAI, Anthropic, and Gemini side by side. Shows that swapping providers requires zero code changes beyond the client.

What it demonstrates:
- Provider portability — same schema, same prompt, different clients
- Comparing latency across providers
- Error handling when a provider fails

---

## 04 — Fallback chain

**File:** [`examples/04-fallback-chain.ts`](../examples/04-fallback-chain.ts)

Classifies news headlines with a primary provider and automatic fallbacks to Anthropic and Groq if the primary is unavailable.

```typescript
generate({
  client: openai,
  model: "gpt-4o-mini",
  fallbackChain: [
    { client: anthropic, model: "claude-haiku-4-5" },
    { client: groq, model: "llama-3.1-8b-instant" },
  ],
  schema: ClassificationSchema,
  prompt: headline,
  hooks: {
    onError: ({ error }) => console.log("Falling back:", error.message),
  },
})
```

What it demonstrates:
- Fallback chain setup
- Using `onError` hook to log fallback events
- Multi-provider resilience patterns

---

## 05 — Streaming

**File:** [`examples/05-streaming.ts`](../examples/05-streaming.ts)

Generates a structured investment analysis report using streaming, showing partial field updates in real time as the LLM writes.

```typescript
const stream = generateStream({
  client: openai,
  model: "gpt-4o",
  schema: ReportSchema,
  prompt: "Write a comprehensive market analysis for the EV industry...",
});

for await (const event of stream) {
  if (event.isDone) {
    console.log("Done:", event.partial.title);
  } else {
    // render partial results as they stream in
    showPartialReport(event.partial);
  }
}
```

What it demonstrates:
- `generateStream()` usage
- Iterating over stream events
- Accessing `.result` for the final validated object
- Practical use case: long-form structured content generation

---

## 06 — Array extraction

**File:** [`examples/06-generate-array.ts`](../examples/06-generate-array.ts)

Parses a bank statement text into an array of typed transaction objects, then calculates totals by category.

```typescript
const { data: transactions } = await generateArray({
  client: openai,
  model: "gpt-4o-mini",
  schema: TransactionSchema,   // schema for ONE transaction
  prompt: bankStatement,
});

// group by category, sum amounts, etc.
```

What it demonstrates:
- `generateArray()` for bulk extraction
- Processing the extracted array with normal JavaScript
- Financial data parsing use case

---

## 07 — createClient for pipelines

**File:** [`examples/07-create-client.ts`](../examples/07-create-client.ts)

Processes a batch of customer emails with a reusable client — extracts intent, urgency, and contact info from each one.

```typescript
const llm = createClient({
  client: new OpenAI(),
  model: "gpt-4o-mini",
  defaultOptions: {
    temperature: 0,
    maxRetries: 2,
    trackUsage: true,
    hooks: { onSuccess: ({ usage }) => analytics.record(usage) },
  },
});

// multiple different schemas, same client
const { data: intent } = await llm.generate({ schema: IntentSchema, prompt: email.body });
const { data: contact } = await llm.generate({ schema: ContactSchema, prompt: email.body });
```

What it demonstrates:
- `createClient()` for pipelines that make many calls
- Running multiple schemas against the same input
- Global hooks for analytics and cost tracking

---

## 08 — Custom schema (no Zod)

**File:** [`examples/08-custom-schema.ts`](../examples/08-custom-schema.ts)

Generates weather data using a hand-rolled validator instead of Zod. Also shows a comment with how to use TypeBox.

```typescript
const WeatherSchema = {
  jsonSchema: {
    type: "object",
    properties: {
      city: { type: "string" },
      temperature: { type: "number" },
      unit: { type: "string", enum: ["celsius", "fahrenheit"] },
    },
    required: ["city", "temperature", "unit"],
  },
  parse: (data: unknown): WeatherData => {
    const d = data as WeatherData;
    if (!["celsius", "fahrenheit"].includes(d.unit)) throw new Error("invalid unit");
    return d;
  },
};

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: WeatherSchema,
  prompt: "Generate current weather for Tokyo.",
});
```

What it demonstrates:
- Custom schema format for users who don't use Zod
- TypeBox integration pattern (commented)
- Practical use case: interoperability with existing validation code

---

## 09 — Fintech analysis

**File:** [`examples/09-fintech-analysis.ts`](../examples/09-fintech-analysis.ts)

Two tasks: (1) parse an earnings call transcript into structured financial data, and (2) classify a batch of financial headlines.

```typescript
const EarningsSchema = z.object({
  ticker: z.string(),
  revenue: z.object({ reported: z.number(), yoyGrowth: z.number(), beatExpectations: z.boolean() }),
  eps: z.object({ diluted: z.number(), yoyGrowth: z.number(), beatExpectations: z.boolean() }),
  guidance: z.object({ raised: z.boolean(), commentary: z.string() }),
  sentiment: z.enum(["bullish", "neutral", "bearish"]),
  // ...
});
```

What it demonstrates:
- Parsing financial documents with complex schemas
- Using `generateArray` for batch classification
- Combining `generate` and `generateArray` in a single workflow
- Real-world fintech use case

---

## 10 — Local models with Ollama

**File:** [`examples/10-ollama-local.ts`](../examples/10-ollama-local.ts)

Runs a code review pipeline entirely locally using Ollama. No API key, no cost.

```bash
ollama pull llama3.2
ollama serve
OPENAI_API_KEY=sk-... npx tsx examples/10-ollama-local.ts  # no key needed for Ollama itself
```

```typescript
const ollama = new OpenAI({
  apiKey: "ollama",
  baseURL: "http://localhost:11434/v1",
});

const { data } = await generate({
  client: ollama,
  model: "llama3.2",
  mode: "json-mode",   // most local models work best with this
  schema: CodeReviewSchema,
  prompt: codeSnippet,
});
```

What it demonstrates:
- Local model setup with Ollama
- Handling `ECONNREFUSED` gracefully when Ollama isn't running
- Using `createClient()` with local models for convenience
- Privacy-preserving use case (no data leaves your machine)

---

## Common patterns

### Processing a list of documents

```typescript
const llm = createClient({ client: openai, model: "gpt-4o-mini" });

const results = await Promise.all(
  documents.map((doc) =>
    llm.generate({ schema: DocumentSchema, prompt: doc.content })
  )
);
```

### Conditional schema based on classification

```typescript
const { data: type } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: z.object({ type: z.enum(["invoice", "receipt", "contract"]) }),
  prompt: documentText,
});

const schema =
  type.type === "invoice" ? InvoiceSchema :
  type.type === "receipt" ? ReceiptSchema :
  ContractSchema;

const { data } = await generate({ client: openai, model: "gpt-4o-mini", schema, prompt: documentText });
```

### Chat history with structured output

```typescript
const history: Message[] = [];

// multi-turn conversation that ends in a structured result
history.push({ role: "user", content: "I need help analyzing a contract." });
history.push({ role: "assistant", content: "Sure, please share the contract text." });
history.push({ role: "user", content: contractText });

const { data } = await generate({
  client: openai,
  model: "gpt-4o",
  schema: ContractAnalysisSchema,
  messages: history,  // pass the full history
});
```

### Extracting from PDFs (with a PDF parser)

```typescript
import pdfParse from "pdf-parse";

const pdf = await pdfParse(fs.readFileSync("document.pdf"));

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: DocumentSchema,
  prompt: pdf.text,
});
```

### Cost budget with hooks

```typescript
let totalCostUsd = 0;
const BUDGET_USD = 1.0;

const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    trackUsage: true,
    hooks: {
      onSuccess: ({ usage }) => {
        totalCostUsd += usage?.estimatedCostUsd ?? 0;
        if (totalCostUsd > BUDGET_USD) {
          throw new Error(`Budget exceeded: $${totalCostUsd.toFixed(4)}`);
        }
      },
    },
  },
});
```
