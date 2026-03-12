# Document Processing

Examples showing how to extract structured data from unstructured documents.

## Resume parsing

Extract structured work history, skills, and education from a CV.

```typescript
import { z } from "zod";
import { generate } from "structured-llm";

const ResumeSchema = z.object({
  fullName: z.string(),
  email: z.string().email().optional(),
  summary: z.string().optional(),
  experience: z.array(z.object({
    company: z.string(),
    title: z.string(),
    startDate: z.string(),
    endDate: z.string().optional(),
    highlights: z.array(z.string()),
  })),
  education: z.array(z.object({
    institution: z.string(),
    degree: z.string(),
    year: z.number().int().optional(),
  })),
  skills: z.array(z.string()),
});

const { data } = await generate({
  client: openai,
  model: "gpt-4o",
  schema: ResumeSchema,
  prompt: `Extract the structured resume data from the following CV:\n\n${cvText}`,
  temperature: 0,
});

console.log(`Parsed ${data.fullName}'s resume`);
console.log(`${data.experience.length} jobs, ${data.skills.length} skills`);
```

## Invoice extraction

Pull billing fields from invoice text or OCR output.

```typescript
import { extract } from "structured-llm";

const { lineItems, total, currency, dueDate } = await extract({
  client: openai,
  model: "gpt-4o-mini",
  prompt: invoiceText,
  fields: {
    vendorName: "string",
    invoiceNumber: "string",
    invoiceDate: "string",
    dueDate: "string?",
    currency: "string",
    lineItems: [{
      description: "string",
      quantity: "number",
      unitPrice: "number",
      amount: "number",
    }],
    subtotal: "number",
    tax: "number?",
    total: "number",
  },
});
```

## Multi-view document analysis

Use `generateMultiSchema` to extract multiple structured views of the same document simultaneously — no need to call the LLM three times.

```typescript
import { z } from "zod";
import { generateMultiSchema } from "structured-llm";

const contractText = `...`;

const { results, totalUsage } = await generateMultiSchema({
  client: openai,
  model: "gpt-4o",
  prompt: `Analyze this legal contract:\n\n${contractText}`,
  trackUsage: true,
  schemas: {
    metadata: z.object({
      title: z.string(),
      effectiveDate: z.string(),
      jurisdiction: z.string(),
      contractType: z.string(),
    }),
    parties: z.object({
      parties: z.array(z.object({
        name: z.string(),
        role: z.enum(["buyer", "seller", "licensor", "licensee", "other"]),
        jurisdiction: z.string().optional(),
      })),
    }),
    risks: z.object({
      risks: z.array(z.object({
        clause: z.string(),
        description: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        recommendation: z.string(),
      })),
    }),
  },
});

console.log("Contract:", results.metadata.data?.title);
console.log("Parties:", results.parties.data?.parties.map((p) => p.name).join(", "));
console.log("High risks:", results.risks.data?.risks.filter((r) => r.severity === "high").length);
console.log("Total tokens:", totalUsage?.totalTokens);
```

## Batch document processing

Process many documents in parallel with `generateBatch`.

```typescript
import { z } from "zod";
import { generateBatch } from "structured-llm";

const SummarySchema = z.object({
  title: z.string(),
  summary: z.string().max(200),
  topics: z.array(z.string()),
  sentiment: z.enum(["positive", "negative", "neutral"]),
});

const documents = await loadDocumentsFromDatabase(); // your data

const { succeeded, failed, totalUsage } = await generateBatch({
  client: openai,
  model: "gpt-4o-mini",
  schema: SummarySchema,
  inputs: documents.map((doc) => ({
    prompt: `Summarize this document:\n\n${doc.content}`,
    systemPrompt: "Be concise. Focus on key facts.",
  })),
  concurrency: 8,
  trackUsage: true,
  onProgress: ({ completed, total }) => {
    process.stdout.write(`\r${completed}/${total} documents processed`);
  },
});

console.log(`\n${succeeded.length} succeeded, ${failed.length} failed`);
console.log(`Total cost: $${totalUsage?.estimatedCostUsd?.toFixed(4)}`);

// Save results
for (const item of succeeded) {
  await db.documents.update(documents[item.index].id, {
    summary: item.data?.summary,
    topics: item.data?.topics,
  });
}
```

## Medical notes extraction

Extract clinical data from free-text medical notes.

```typescript
import { z } from "zod";
import { generate } from "structured-llm";

const ClinicalNoteSchema = z.object({
  patientAge: z.number().int().optional(),
  chiefComplaint: z.string(),
  vitalSigns: z.object({
    bloodPressure: z.string().optional(),
    heartRate: z.number().optional(),
    temperature: z.number().optional(),
    oxygenSaturation: z.number().optional(),
  }),
  symptoms: z.array(z.string()),
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string().optional(),
    frequency: z.string().optional(),
  })),
  assessment: z.string(),
  plan: z.array(z.string()),
});

const { data } = await generate({
  client: anthropic,
  model: "claude-sonnet-4-6",
  schema: ClinicalNoteSchema,
  systemPrompt: "You are a clinical data extraction assistant. Extract only information explicitly stated in the note.",
  prompt: clinicalNoteText,
  temperature: 0,
  maxRetries: 5,
});
```

## Tips

- Use `temperature: 0` for extraction tasks — you want deterministic, faithful output
- For long documents, consider chunking and summarizing before extraction
- `generateMultiSchema` cuts API calls from N to 1 when you need multiple views
- Use `maxRetries: 5` with `strategy: "exponential"` for critical extraction pipelines
