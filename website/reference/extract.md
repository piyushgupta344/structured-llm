# extract()

Extract specific fields from free-form text without writing a Zod schema.

```typescript
import { extract } from "structured-llm";

const data = await extract(options);
```

## Field types

| Type | Description | TypeScript type |
|---|---|---|
| `"string"` | Plain text | `string` |
| `"number"` | Any number | `number` |
| `"integer"` | Whole number | `number` |
| `"boolean"` | True/false | `boolean` |
| `"email"` | Validated email | `string` |
| `"phone"` | Phone number | `string` |
| `"url"` | URL | `string` |
| `"date"` | ISO 8601 date | `string` |

## Options

```typescript
interface ExtractOptions<F extends ExtractFields> {
  // Provider (same as generate())
  client?: ...; provider?: ...; model: string;

  // Input
  prompt: string;
  systemPrompt?: string;

  // Fields to extract
  fields: Record<string, FieldType | FieldDef>;
  requireAll?: boolean;   // make all fields required (default: false)
}

type FieldType = "string" | "number" | "integer" | "boolean" | "date" | "email" | "phone" | "url";

interface FieldDef {
  type: FieldType;
  description?: string;   // hint for the LLM
  required?: boolean;
  options?: string[];     // enum values
}
```

## Return value

Returns an object with all the fields you defined. All fields are optional unless `required: true` or `requireAll: true`.

```typescript
type ExtractResult<F> = { [K in keyof F]?: FieldToType<F[K]> };
```

## Examples

### Simple extraction

```typescript
const data = await extract({
  client: openai,
  model: "gpt-4o-mini",
  prompt: "Contact: Alice Smith, alice@example.com, +1 (555) 123-4567",
  fields: {
    name: "string",
    email: "email",
    phone: "phone",
  },
});

console.log(data.name);   // "Alice Smith"
console.log(data.email);  // "alice@example.com"
console.log(data.phone);  // "+1 (555) 123-4567"
```

### Invoice parsing

```typescript
const data = await extract({
  client: openai,
  model: "gpt-4o-mini",
  prompt: invoiceText,
  fields: {
    invoiceNumber: { type: "string", description: "Invoice ID", required: true },
    totalAmount:   { type: "number", description: "Total amount due", required: true },
    issueDate:     { type: "date", description: "Date the invoice was issued" },
    dueDate:       { type: "date", description: "Payment due date" },
    vendorEmail:   { type: "email" },
    status: {
      type: "string",
      options: ["draft", "sent", "paid", "overdue"],
    },
  },
});

console.log(data.invoiceNumber); // "INV-2024-00842"
console.log(data.totalAmount);   // 10476
console.log(data.status);        // "sent"
```

### All fields required

```typescript
const data = await extract({
  client: openai,
  model: "gpt-4o-mini",
  prompt: resumeText,
  fields: {
    name: "string",
    email: "email",
    yearsExperience: "integer",
  },
  requireAll: true,  // all three must be present or validation fails
});
```
