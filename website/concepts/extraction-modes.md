# Extraction Modes

structured-llm supports four ways to get structured output from an LLM. The right mode depends on what the model supports.

## Modes

### `tool-calling` (recommended)

Uses the provider's native function-calling / tool-use API to request a structured response. The schema is sent as a tool definition and the model is instructed to call it.

- Most reliable — the model is specifically trained for this
- Widely supported: OpenAI, Anthropic, Gemini, Mistral, Groq, Cohere, and others
- Schema is enforced at the API level on providers that support constrained decoding

### `json-mode`

Instructs the model to respond with raw JSON matching the schema. The schema is injected into the system prompt and JSON mode is enabled if the provider supports it (e.g. `response_format: { type: "json_object" }` for OpenAI).

- Good fallback when tool-calling isn't available
- Less reliable than tool-calling — the model may produce valid JSON that doesn't match the schema
- Works on most providers

### `prompt-inject`

The schema is injected into the system prompt as a natural-language instruction. No special API features are used.

- Works on **any** model, including local models via Ollama
- Least reliable of the three — depends on the model following instructions
- Useful for models that don't support tool-calling or JSON mode

### `auto` (default)

structured-llm picks the best mode for the model automatically.

- Uses the model registry to determine capabilities
- Falls back to `json-mode` or `prompt-inject` for models without tool-calling support
- Best choice in most cases — you can always override

## Setting the mode

```typescript
// Let structured-llm decide (default)
generate({ ..., mode: "auto" });

// Force a specific mode
generate({ ..., mode: "tool-calling" });
generate({ ..., mode: "json-mode" });
generate({ ..., mode: "prompt-inject" });
```

## Mode selection logic

| Model supports | Mode chosen by `auto` |
|---|---|
| Tool calling | `tool-calling` |
| JSON mode only | `json-mode` |
| Neither | `prompt-inject` |

You can inspect what mode would be chosen for a model without making an API call:

```typescript
import { resolveMode } from "structured-llm";

console.log(resolveMode("gpt-4o-mini"));       // "tool-calling"
console.log(resolveMode("llama3.1", "auto"));  // "prompt-inject"
```

## When to override

**Force `json-mode`** when:
- You're hitting token limits from large tool schemas
- The provider charges extra for tool calls
- You're seeing hallucinated tool calls on certain models

**Force `prompt-inject`** when:
- Using a local model (Ollama) that doesn't support structured APIs
- Using a model not in the registry and you're unsure of its capabilities
- Debugging — prompt-inject makes it easy to see exactly what the model receives

**Force `tool-calling`** when:
- `auto` is selecting `json-mode` but the model supports tool calls
- You want the strictest schema enforcement available

## Provider-specific notes

| Provider | Tool calling | JSON mode | Notes |
|---|---|---|---|
| OpenAI | yes | yes | Supports `strict` mode for full schema adherence |
| Anthropic | yes | yes | Tool use since Claude 3 |
| Gemini | yes | yes | Supported in all current models |
| Mistral | yes | yes | |
| Groq | yes | yes | |
| Cohere | yes | no | Command-R and later |
| Ollama | no | model-dependent | Use `prompt-inject` for best compatibility |
| Together AI | model-dependent | yes | Varies by hosted model |
| Fireworks | model-dependent | yes | Varies by hosted model |
