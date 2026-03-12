# TypeScript Setup

structured-llm is written in TypeScript and ships with full type definitions. This page covers the recommended setup and common type patterns.

## Requirements

- TypeScript 5.0 or later
- `"moduleResolution": "bundler"` or `"node16"` / `"nodenext"` in `tsconfig.json`

## Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  }
}
```

If you're using Node.js without a bundler, use `"moduleResolution": "node16"` instead and set `"module": "node16"`.

## Type inference

The return type of `generate()` is automatically inferred from your schema:

```typescript
import { z } from "zod";
import { generate } from "structured-llm";

const PersonSchema = z.object({
  name: z.string(),
  age: z.number(),
  email: z.string().email(),
});

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: PersonSchema,
  prompt: "...",
});

// data is inferred as { name: string; age: number; email: string }
data.name;   // string ✓
data.age;    // number ✓
data.email;  // string ✓
```

## Using inferred types

Extract the inferred type when you need to pass it around:

```typescript
import { z } from "zod";

const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  inStock: z.boolean(),
});

// Extract the TypeScript type from the Zod schema
type Product = z.infer<typeof ProductSchema>;

// Use it in function signatures
function displayProduct(product: Product) {
  console.log(`${product.name}: $${product.price}`);
}

const { data } = await generate({ ..., schema: ProductSchema, prompt: "..." });
displayProduct(data); // ✓ fully typed
```

## Typing the client

`createClient` returns a `StructuredLLMClient` — import the type when you need to pass the client around:

```typescript
import { createClient } from "structured-llm";
import type { StructuredLLMClient } from "structured-llm";

export const llm = createClient({ client: openai, model: "gpt-4o-mini" });

// Pass the client to a service
class DocumentService {
  constructor(private llm: StructuredLLMClient) {}

  async summarize(text: string) {
    return this.llm.generate({
      schema: SummarySchema,
      prompt: text,
    });
  }
}
```

## Typing generateStream events

```typescript
import type { StreamEvent } from "structured-llm";

const ReportSchema = z.object({ title: z.string(), body: z.string() });
type Report = z.infer<typeof ReportSchema>;

function handleEvent(event: StreamEvent<Report>) {
  if (event.isDone) {
    // event.partial is Report — fully typed
    console.log(event.partial.title);
  } else {
    // event.partial is Partial<Report>
    console.log(event.partial.title ?? "loading...");
  }
}
```

## Typing hooks

```typescript
import type { Hooks } from "structured-llm";
import { z } from "zod";

const MySchema = z.object({ result: z.string() });
type MyResult = z.infer<typeof MySchema>;

// Hooks are typed to the schema's output type
const hooks: Hooks<MyResult> = {
  onSuccess: ({ result }) => {
    // result is MyResult — fully typed
    console.log(result.result);
  },
};
```

## Narrowing errors

Error classes from structured-llm extend `Error` and carry extra context. Use `instanceof` to narrow them:

```typescript
import {
  ValidationError,
  ParseError,
  ProviderError,
  MaxRetriesError,
  MissingInputError,
} from "structured-llm";

try {
  const { data } = await generate({ ... });
} catch (err) {
  if (err instanceof ValidationError) {
    // err.issues: string[]
    // err.lastResponse: string
    // err.attempts: number
    console.log("Validation failed:", err.issues);
  } else if (err instanceof ProviderError) {
    // err.provider: ProviderName
    // err.statusCode?: number
    console.log("Provider error:", err.provider, err.statusCode);
  } else if (err instanceof ParseError) {
    // err.rawResponse: string
    console.log("Parse error:", err.rawResponse);
  }
}
```

## Strict mode

With `"strict": true` in tsconfig, TypeScript will catch common mistakes:

```typescript
// ✗ TypeScript error: Property 'nonExistent' does not exist
const { data } = await generate({ ..., schema: PersonSchema, prompt: "..." });
data.nonExistent;

// ✓ Correct
data.name;
```

## Module resolution troubleshooting

If you see `Cannot find module 'structured-llm'` errors:

1. Ensure `"moduleResolution": "bundler"` or `"node16"` is set
2. If using Jest or Vitest, configure the resolver to handle ESM
3. Check that `structured-llm` is in `dependencies` (not just `devDependencies`)

For Vitest, add to `vite.config.ts`:
```typescript
export default {
  test: {
    globals: true,
  },
};
```

For Jest, add to `jest.config.ts`:
```typescript
export default {
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
```
