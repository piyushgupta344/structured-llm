# createTemplate()

Bind a reusable prompt template to a schema and provider config. Variables are interpolated with `{{varName}}` syntax.

```typescript
import { createTemplate } from "structured-llm";

const analyzeDoc = createTemplate({
  template: "Analyze this {{docType}} from {{company}}:\n\n{{content}}",
  schema: AnalysisSchema,
  client: openai,
  model: "gpt-4o-mini",
});

const { data } = await analyzeDoc.run({
  docType: "invoice",
  company: "Acme Corp",
  content: invoiceText,
});
```

## Options

```typescript
interface TemplateConfig<TSchema> extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
  template: string;  // prompt template with {{variableName}} placeholders
}

type TemplateVars = Record<string, string | number>;
```

## Return value

`createTemplate` returns a `BoundTemplate` with three methods:

```typescript
interface BoundTemplate<TSchema> {
  // Run template → generate a single object
  run(
    vars: TemplateVars,
    overrides?: Partial<Omit<GenerateOptions<TSchema>, "prompt">>
  ): Promise<GenerateResult<z.infer<TSchema>>>;

  // Run template → generate an array of objects
  runArray(
    vars: TemplateVars,
    overrides?: Partial<Omit<GenerateArrayOptions<TSchema>, "prompt">>
  ): Promise<GenerateArrayResult<z.infer<TSchema>>>;

  // Render the template without calling the LLM (useful for debugging)
  render(vars: TemplateVars): string;
}
```

## Examples

### Commit message generator

```typescript
import { z } from "zod";
import { createTemplate } from "structured-llm";

const CommitSchema = z.object({
  type: z.enum(["feat", "fix", "docs", "refactor", "test", "chore"]),
  scope: z.string().optional(),
  subject: z.string().max(72),
  body: z.string().optional(),
  breaking: z.boolean(),
});

const commitTemplate = createTemplate({
  template: `Generate a conventional commit message for this git diff:

\`\`\`diff
{{diff}}
\`\`\`

Repository: {{repo}}
Branch: {{branch}}`,
  schema: CommitSchema,
  client: openai,
  model: "gpt-4o-mini",
  temperature: 0,
});

const { data } = await commitTemplate.run({
  diff: gitDiff,
  repo: "my-app",
  branch: "feat/new-feature",
});

console.log(`${data.type}(${data.scope}): ${data.subject}`);
```

### Market research across multiple topics

```typescript
const MarketReportSchema = z.object({
  marketSize: z.string(),
  topPlayers: z.array(z.string()),
  growthRate: z.string(),
  opportunities: z.array(z.string()),
  risks: z.array(z.string()),
});

const marketTemplate = createTemplate({
  template: "Provide a market analysis for {{industry}} in {{region}} as of {{year}}.",
  schema: MarketReportSchema,
  client: openai,
  model: "gpt-4o",
});

const markets = [
  { industry: "EV batteries", region: "North America", year: "2025" },
  { industry: "solar panels", region: "Southeast Asia", year: "2025" },
  { industry: "wind turbines", region: "Europe", year: "2025" },
];

const reports = await Promise.all(markets.map((vars) => marketTemplate.run(vars)));
```

### Extract a list with runArray

```typescript
const skillTemplate = createTemplate({
  template: "Extract all technical skills from this job description:\n\n{{jobDescription}}",
  schema: z.object({
    name: z.string(),
    category: z.enum(["language", "framework", "tool", "cloud", "other"]),
    required: z.boolean(),
  }),
  client: openai,
  model: "gpt-4o-mini",
});

const { data: skills } = await skillTemplate.runArray(
  { jobDescription: jobPost },
  { minItems: 3 }
);
```

### Override options per run

```typescript
const template = createTemplate({
  template: "Summarize: {{text}}",
  schema: SummarySchema,
  client: openai,
  model: "gpt-4o-mini",
  temperature: 0,
});

// Use defaults for most calls
const summary1 = await template.run({ text: doc1 });

// Override temperature for a creative variant
const summary2 = await template.run({ text: doc2 }, { temperature: 0.8 });
```

### Debugging with render

```typescript
const rendered = template.render({ text: "Hello world" });
console.log(rendered);
// "Summarize: Hello world"
```

If a required variable is missing, `render()` (and `run()`) throw:
```
Error: Template variable "{{text}}" not provided
```
