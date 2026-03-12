# Custom Schemas

structured-llm works with Zod out of the box. It also supports any library implementing the **Standard Schema v1** protocol (Valibot, ArkType, Effect Schema, and others), as well as fully custom schemas that you define yourself.

## Standard Schema (Valibot, ArkType, etc.)

Libraries that implement the [Standard Schema v1 spec](https://standardschema.dev) are auto-detected and work without any adapters:

```typescript
import * as v from "valibot";
import { generate } from "structured-llm";

const PersonSchema = v.object({
  name: v.string(),
  age: v.number(),
  email: v.pipe(v.string(), v.email()),
});

// Just pass it — no adapter needed
const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: PersonSchema,
  prompt: "Extract: Alice Smith, 28, alice@example.com",
});
// data.name, data.age, data.email are fully typed
```

### Explicit conversion

If auto-detection doesn't work, convert explicitly with `fromStandardSchema`:

```typescript
import { generate, fromStandardSchema } from "structured-llm";
import * as v from "valibot";

const schema = fromStandardSchema(v.object({ name: v.string() }));

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: schema as any,
  prompt: "...",
});
```

## Fully custom schemas

Provide your own schema adapter with `jsonSchema` and `parse`:

```typescript
import { generate } from "structured-llm";
import type { CustomSchema } from "structured-llm";

const mySchema: CustomSchema<{ score: number; label: string }> = {
  jsonSchema: {
    type: "object",
    properties: {
      score: { type: "number", minimum: 0, maximum: 1 },
      label: { type: "string", enum: ["positive", "negative", "neutral"] },
    },
    required: ["score", "label"],
  },
  parse(data: unknown) {
    const d = data as { score: number; label: string };
    if (typeof d.score !== "number") throw new Error("score must be a number");
    if (!["positive", "negative", "neutral"].includes(d.label)) {
      throw new Error("invalid label");
    }
    return d;
  },
};

const { data } = await generate({
  client: openai,
  model: "gpt-4o-mini",
  schema: mySchema,
  prompt: "Analyze the sentiment: 'Amazing product!'",
});
```

### CustomSchema interface

```typescript
interface CustomSchema<T = unknown> {
  jsonSchema: JSONSchema;    // JSON Schema sent to the LLM
  parse: (data: unknown) => T;  // throws on invalid data
  safeParse?: (data: unknown) => { success: true; data: T } | { success: false; error: string };
}
```

If `safeParse` is omitted, structured-llm wraps `parse` in a try/catch automatically.

## Using resolveSchema directly

`resolveSchema` is the internal function that converts any supported schema type into a `SchemaAdapter`. You can use it to introspect the JSON schema that would be sent to the LLM:

```typescript
import { resolveSchema } from "structured-llm";
import { z } from "zod";

const adapter = resolveSchema(z.object({ name: z.string(), age: z.number() }));

console.log(adapter.jsonSchema);
// {
//   type: "object",
//   properties: { name: { type: "string" }, age: { type: "number" } },
//   required: ["name", "age"]
// }

// Also parse and validate:
const result = adapter.safeParse({ name: "Alice", age: 28 });
console.log(result.success); // true
```

## Schema detection order

When a schema is passed to any `generate*` function, structured-llm resolves it in this order:

1. **Zod schema** — detected by `_def.typeName` (Zod v3) or `~standard.vendor === "zod"` (Zod v4)
2. **Standard Schema** — detected by `~standard.version === 1` and `typeof ~standard.validate === "function"`
3. **Custom schema** — detected by the presence of `jsonSchema` and `parse` properties
4. Throws `SchemaError` if none match

## Supported Standard Schema libraries

| Library | Version | Notes |
|---|---|---|
| Valibot | v1.0+ | Full support |
| ArkType | v2.0+ | Full support |
| Effect Schema | current | Full support |
| Zod v4 | v4.0+ | Auto-detected as Standard Schema |

For libraries that expose JSON Schema differently (e.g. `.jsonSchema`, `.json`, or nested under `.~standard.schema`), structured-llm tries multiple property names before falling back to an empty schema.
