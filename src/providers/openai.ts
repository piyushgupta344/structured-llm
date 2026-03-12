import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";
import type { JSONSchema, ProviderName } from "../types.js";
import { ProviderError } from "../errors.js";

// ---------------------------------------------------------------------------
// OpenAI Structured Outputs — strict JSON schema helpers
// ---------------------------------------------------------------------------

function isNullable(schema: JSONSchema): boolean {
  if (Array.isArray(schema.type) && schema.type.includes("null")) return true;
  if (schema.anyOf?.some((s) => s.type === "null")) return true;
  return false;
}

/**
 * Deep-transforms a JSON Schema so it satisfies OpenAI's strict mode rules:
 *   - every object has `additionalProperties: false`
 *   - every object property is listed in `required`
 *   - previously-optional (non-required) properties are wrapped as `{ anyOf: [T, { type: "null" }] }`
 *     so the model can still omit them by returning null
 */
export function makeStrictSchema(schema: JSONSchema): JSONSchema {
  if (!schema || typeof schema !== "object") return schema;

  // Recurse into $defs first
  const defs = schema.$defs
    ? Object.fromEntries(
        Object.entries(schema.$defs).map(([k, v]) => [k, makeStrictSchema(v)])
      )
    : undefined;

  const type = schema.type;

  if (type === "object" || (Array.isArray(type) && type.includes("object")) || schema.properties) {
    const originalRequired = new Set<string>(schema.required ?? []);
    const properties = schema.properties ?? {};

    const newProperties: Record<string, JSONSchema> = {};
    for (const [key, propSchema] of Object.entries(properties)) {
      const strict = makeStrictSchema(propSchema);
      if (!originalRequired.has(key) && !isNullable(strict)) {
        // Wrap optional properties as nullable so the model can return null
        newProperties[key] = { anyOf: [strict, { type: "null" }] };
      } else {
        newProperties[key] = strict;
      }
    }

    return {
      ...schema,
      ...(defs ? { $defs: defs } : {}),
      properties: newProperties,
      required: Object.keys(newProperties),
      additionalProperties: false,
    };
  }

  if (type === "array" || (Array.isArray(type) && type.includes("array"))) {
    return {
      ...schema,
      ...(defs ? { $defs: defs } : {}),
      items: schema.items ? makeStrictSchema(schema.items) : schema.items,
    };
  }

  // Recurse into composition keywords
  const result: JSONSchema = { ...schema, ...(defs ? { $defs: defs } : {}) };
  if (schema.anyOf) result.anyOf = schema.anyOf.map(makeStrictSchema);
  if (schema.oneOf) result.oneOf = schema.oneOf.map(makeStrictSchema);
  if (schema.allOf) result.allOf = schema.allOf.map(makeStrictSchema);
  return result;
}

// Works for OpenAI and any OpenAI-compatible provider (Groq, xAI, Together, etc.)
export class OpenAIAdapter implements ProviderAdapter {
  readonly name: ProviderName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any, name: ProviderName = "openai") {
    this.client = client;
    this.name = name;
  }

  async complete(req: AdapterRequest): Promise<AdapterResponse> {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens, topP, seed, signal } = req;

    const oaiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      if (mode === "json-schema") {
        const resp = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
          top_p: topP,
          seed,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              strict: true,
              schema: makeStrictSchema(schema),
            },
          },
        }, { signal });

        return {
          text: resp.choices[0]?.message?.content ?? "",
          promptTokens: resp.usage?.prompt_tokens,
          completionTokens: resp.usage?.completion_tokens,
        };
      }

      if (mode === "tool-calling") {
        const resp = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
          top_p: topP,
          seed,
          tools: [
            {
              type: "function",
              function: {
                name: schemaName,
                description: `Extract data matching the ${schemaName} schema`,
                parameters: schema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: schemaName } },
        }, { signal });

        const toolCall = resp.choices[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          throw new ProviderError(this.name, "No tool call in response");
        }

        return {
          text: toolCall.function.arguments,
          promptTokens: resp.usage?.prompt_tokens,
          completionTokens: resp.usage?.completion_tokens,
        };
      }

      if (mode === "json-mode") {
        const resp = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
          top_p: topP,
          seed,
          response_format: { type: "json_object" },
        }, { signal });

        return {
          text: resp.choices[0]?.message?.content ?? "",
          promptTokens: resp.usage?.prompt_tokens,
          completionTokens: resp.usage?.completion_tokens,
        };
      }

      // prompt-inject — no special format, schema is embedded in the system message
      const resp = await this.client.chat.completions.create({
        model,
        messages: oaiMessages,
        temperature: temperature ?? 0,
        max_tokens: maxTokens,
        top_p: topP,
        seed,
      }, { signal });

      return {
        text: resp.choices[0]?.message?.content ?? "",
        promptTokens: resp.usage?.prompt_tokens,
        completionTokens: resp.usage?.completion_tokens,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError(
        this.name,
        e?.message ?? String(err),
        e?.status ?? e?.statusCode,
        err
      );
    }
  }

  async *stream(req: AdapterRequest): AsyncIterable<string> {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens, topP, seed, signal } = req;
    const oaiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      if (mode === "json-schema") {
        const stream = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
          top_p: topP,
          seed,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: schemaName,
              strict: true,
              schema: makeStrictSchema(schema),
            },
          },
          stream: true,
        }, { signal });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) yield delta;
        }
        return;
      }

      if (mode === "tool-calling") {
        const stream = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
          top_p: topP,
          seed,
          tools: [
            {
              type: "function",
              function: {
                name: schemaName,
                description: `Extract data matching the ${schemaName} schema`,
                parameters: schema,
              },
            },
          ],
          tool_choice: { type: "function", function: { name: schemaName } },
          stream: true,
        }, { signal });

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.tool_calls?.[0]?.function?.arguments ?? "";
          if (delta) yield delta;
        }
        return;
      }

      const stream = await this.client.chat.completions.create({
        model,
        messages: oaiMessages,
        temperature: temperature ?? 0,
        max_tokens: maxTokens,
        top_p: topP,
        seed,
        ...(mode === "json-mode" ? { response_format: { type: "json_object" } } : {}),
        stream: true,
      }, { signal });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) yield delta;
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError(this.name, e?.message ?? String(err), e?.status, err);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isOpenAIClient(client: any): boolean {
  return (
    client?.constructor?.name === "OpenAI" ||
    // some bundlers rename classes, so also check the API shape
    (typeof client?.chat?.completions?.create === "function" &&
      typeof client?.models?.list === "function")
  );
}
