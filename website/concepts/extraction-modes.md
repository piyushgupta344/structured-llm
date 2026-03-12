# Extraction Modes

structured-llm supports five ways to get structured output from an LLM. The right mode depends on what the model supports.

## Modes

### `json-schema` (best for supported OpenAI models)

Uses OpenAI's [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs) API — `response_format: { type: "json_schema", json_schema: { strict: true, schema } }`. The schema is enforced at the API level: the model **cannot** return output that violates the schema.

- Strongest guarantee — schema adherence is enforced server-side, not just validated
- No hallucinated tool calls or format drift
- Supported on: `gpt-4o` (≥2024-08-06), `gpt-4o-mini`, `gpt-4.1` family, `o3`, `o3-mini`, `o4-mini`
- structured-llm automatically transforms your Zod schema to satisfy OpenAI's strict mode rules (adds `additionalProperties: false`, promotes optional fields to nullable)

### `tool-calling`

Uses the provider's native function-calling / tool-use API to request a structured response. The schema is sent as a tool definition and the model is instructed to call it.

- Very reliable — the model is specifically trained for this
- Widely supported: OpenAI, Anthropic, Gemini, Mistral, Groq, Cohere, and others
- Schema is enforced at the API level on providers that support constrained decoding

### `json-mode`

Instructs the model to respond with raw JSON matching the schema. The schema is injected into the system prompt and JSON mode is enabled if the provider supports it (e.g. `response_format: { type: "json_object" }` for OpenAI).

- Good fallback when tool-calling isn't available
- Less reliable — the model may produce valid JSON that doesn't match the schema
- Works on most providers

### `prompt-inject`

The schema is injected into the system prompt as a natural-language instruction. No special API features are used.

- Works on **any** model, including local models via Ollama
- Least reliable — depends on the model following instructions
- Useful for models that don't support tool-calling or JSON mode

### `auto` (default)

structured-llm picks the best mode for the model automatically.

- Uses the model registry to determine capabilities
- Prefers `json-schema` for models that support strict JSON schema (all modern OpenAI models)
- Falls back to `tool-calling`, `json-mode`, then `prompt-inject` in that order
- Best choice in most cases — you can always override

## Setting the mode

```typescript
// Let structured-llm decide (default)
generate({ ..., mode: "auto" });

// Force a specific mode
generate({ ..., mode: "json-schema" });   // OpenAI Structured Outputs
generate({ ..., mode: "tool-calling" });
generate({ ..., mode: "json-mode" });
generate({ ..., mode: "prompt-inject" });
```

## Mode selection logic

| Model supports | Mode chosen by `auto` |
|---|---|
| Strict JSON schema (OpenAI) | `json-schema` |
| Tool calling | `tool-calling` |
| JSON mode only | `json-mode` |
| Neither | `prompt-inject` |

You can inspect what mode would be chosen for a model without making an API call:

```typescript
import { resolveMode } from "structured-llm";

console.log(resolveMode("gpt-4o-mini"));       // "json-schema"
console.log(resolveMode("claude-sonnet-4-6")); // "tool-calling"
console.log(resolveMode("llama3.1", "auto"));  // "tool-calling"
```

## When to override

**Force `json-schema`** when:
- You want the strictest schema guarantee available from OpenAI
- You're using a gpt-4o / gpt-4.1 / o3 / o4-mini model and `auto` hasn't kicked in

**Force `tool-calling`** when:
- `auto` is selecting `json-schema` but you prefer the tool-calling path (e.g. to compare latency)
- You're using a non-OpenAI provider that doesn't support strict JSON schema
- You want the strictest schema enforcement on non-OpenAI providers

**Force `json-mode`** when:
- You're hitting token limits from large tool/schema definitions
- The provider charges extra for tool calls
- You're seeing hallucinated tool calls on certain models

**Force `prompt-inject`** when:
- Using a local model (Ollama) that doesn't support structured APIs
- Using a model not in the registry and you're unsure of its capabilities
- Debugging — prompt-inject makes it easy to see exactly what the model receives

## How `json-schema` strict mode transforms your schema

OpenAI's strict mode requires every object to have `additionalProperties: false` and all properties to be listed in `required`. structured-llm handles this automatically:

- All objects get `additionalProperties: false`
- All properties are moved into `required`
- Previously-optional Zod fields (e.g. `z.string().optional()`) are preserved by wrapping as `{ anyOf: [T, { type: "null" }] }` — the model returns `null` when the field is absent, and structured-llm's schema validation handles the rest

You never need to think about this — it happens transparently when `mode: "json-schema"` is active.

## Provider-specific notes

| Provider | Strict JSON schema | Tool calling | JSON mode | Notes |
|---|---|---|---|---|
| OpenAI | ✓ (gpt-4o/4.1/o3/o4) | ✓ | ✓ | Strict mode enforces schema server-side |
| Anthropic | — | ✓ | — | Tool use since Claude 3; json-schema falls back to tool-calling |
| Gemini | — | ✓ | ✓ | json-schema falls back to tool-calling |
| Mistral | — | ✓ | ✓ | json-schema falls back to tool-calling |
| Groq | — | ✓ | ✓ | |
| Cohere | — | ✓ | — | Command-R and later |
| AWS Bedrock | — | ✓ | — | json-schema falls back to tool-calling |
| Ollama | — | model-dependent | ✓ | Use `prompt-inject` for best compatibility |
| Together AI | — | model-dependent | ✓ | Varies by hosted model |
| Fireworks | — | model-dependent | ✓ | Varies by hosted model |
