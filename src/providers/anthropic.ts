import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";
import { ProviderError } from "../errors.js";

export class AnthropicAdapter implements ProviderAdapter {
  readonly name = "anthropic" as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  async complete(req: AdapterRequest): Promise<AdapterResponse> {
    const { model, messages, schema, schemaName, mode: rawMode, temperature, maxTokens, topP, signal } = req;
    // Anthropic doesn't support OpenAI-style strict JSON schema; fall back to tool-calling
    const mode = rawMode === "json-schema" ? "tool-calling" : rawMode;

    // Anthropic separates system messages from user/assistant turns
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    try {
      if (mode === "tool-calling") {
        const resp = await this.client.messages.create({
          model,
          max_tokens: maxTokens ?? 4096,
          temperature: temperature ?? 0,
          top_p: topP,
          system: systemMsg,
          messages: turns,
          tools: [
            {
              name: schemaName,
              description: `Extract data matching the ${schemaName} schema`,
              input_schema: { ...schema, type: "object" },
            },
          ],
          tool_choice: { type: "tool", name: schemaName },
        }, { signal });

        const toolUse = resp.content.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (b: any) => b.type === "tool_use" && b.name === schemaName
        );
        if (!toolUse) {
          throw new ProviderError("anthropic", "No tool_use block in response");
        }

        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          text: JSON.stringify((toolUse as any).input),
          promptTokens: resp.usage?.input_tokens,
          completionTokens: resp.usage?.output_tokens,
        };
      }

      // Anthropic doesn't have a native JSON mode; embed schema in system prompt
      const systemWithSchema = [
        systemMsg,
        `Respond with ONLY valid JSON that matches this JSON Schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include markdown code fences or any text outside the JSON object.`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const resp = await this.client.messages.create({
        model,
        max_tokens: maxTokens ?? 4096,
        temperature: temperature ?? 0,
        top_p: topP,
        system: systemWithSchema,
        messages: turns,
      }, { signal });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textBlock = resp.content.find((b: any) => b.type === "text");
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        text: (textBlock as any)?.text ?? "",
        promptTokens: resp.usage?.input_tokens,
        completionTokens: resp.usage?.output_tokens,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("anthropic", e?.message ?? String(err), e?.status, err);
    }
  }

  async *stream(req: AdapterRequest): AsyncIterable<string> {
    const { model, messages, schema, schemaName, mode: rawMode, temperature, maxTokens, topP, signal } = req;
    const mode = rawMode === "json-schema" ? "tool-calling" : rawMode;
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    try {
      if (mode === "tool-calling") {
        const stream = this.client.messages.stream({
          model,
          max_tokens: maxTokens ?? 4096,
          temperature: temperature ?? 0,
          top_p: topP,
          system: systemMsg,
          messages: turns,
          tools: [
            {
              name: schemaName,
              description: `Extract data matching the ${schemaName} schema`,
              input_schema: { ...schema, type: "object" },
            },
          ],
          tool_choice: { type: "tool", name: schemaName },
        }, { signal });

        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta?.type === "input_json_delta"
          ) {
            yield event.delta.partial_json ?? "";
          }
        }
        return;
      }

      const systemWithSchema = [
        systemMsg,
        `Respond with ONLY valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens ?? 4096,
        temperature: temperature ?? 0,
        top_p: topP,
        system: systemWithSchema,
        messages: turns,
      }, { signal });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          yield event.delta.text ?? "";
        }
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("anthropic", e?.message ?? String(err), e?.status, err);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isAnthropicClient(client: any): boolean {
  return (
    client?.constructor?.name === "Anthropic" ||
    typeof client?.messages?.create === "function"
  );
}
