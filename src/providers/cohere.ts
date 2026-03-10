import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";
import { ProviderError } from "../errors.js";

export class CohereAdapter implements ProviderAdapter {
  readonly name = "cohere" as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  async complete(req: AdapterRequest): Promise<AdapterResponse> {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;

    const systemMsg = messages.find((m) => m.role === "system")?.content;
    // Cohere uses preamble for system context
    const chatHistory = messages
      .filter((m) => m.role !== "system")
      .slice(0, -1)
      .map((m) => ({
        role: m.role === "assistant" ? "CHATBOT" : "USER",
        message: m.content,
      }));

    const lastUserMsg =
      messages.filter((m) => m.role !== "system").at(-1)?.content ?? "";

    try {
      if (mode === "tool-calling") {
        const resp = await this.client.chat({
          model,
          message: lastUserMsg,
          chatHistory,
          preamble: systemMsg,
          temperature,
          maxTokens,
          tools: [
            {
              name: schemaName,
              description: `Extract data matching the ${schemaName} schema`,
              parameterDefinitions: jsonSchemaToCohereTool(schema),
            },
          ],
          forceToolUse: true,
        });

        const toolCall = resp.toolCalls?.[0];
        if (!toolCall?.parameters) {
          throw new ProviderError("cohere", "No tool call in response");
        }

        return {
          text: JSON.stringify(toolCall.parameters),
          promptTokens: resp.meta?.tokens?.inputTokens,
          completionTokens: resp.meta?.tokens?.outputTokens,
        };
      }

      // Cohere JSON mode via response_format
      const resp = await this.client.chat({
        model,
        message: lastUserMsg,
        chatHistory,
        preamble: systemMsg
          ? `${systemMsg}\n\nRespond with ONLY valid JSON matching: ${JSON.stringify(schema)}`
          : `Respond with ONLY valid JSON matching: ${JSON.stringify(schema)}`,
        temperature,
        maxTokens,
        responseFormat: { type: "json_object" },
      });

      return {
        text: resp.text ?? "",
        promptTokens: resp.meta?.tokens?.inputTokens,
        completionTokens: resp.meta?.tokens?.outputTokens,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("cohere", e?.message ?? String(err), e?.statusCode, err);
    }
  }
}

// Cohere needs a flattened parameter definition format (not JSON Schema)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function jsonSchemaToCohereTool(schema: any): Record<string, unknown> {
  const props = schema.properties ?? {};
  const required: string[] = schema.required ?? [];
  const result: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(props as Record<string, Record<string, unknown>>)) {
    result[key] = {
      description: val.description ?? key,
      type: cohereType(val.type as string),
      required: required.includes(key),
    };
  }
  return result;
}

function cohereType(jsonType: string): string {
  const map: Record<string, string> = {
    string: "str",
    number: "float",
    integer: "int",
    boolean: "bool",
    array: "list",
    object: "dict",
  };
  return map[jsonType] ?? "str";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isCohereClient(client: any): boolean {
  return (
    client?.constructor?.name === "CohereClient" ||
    client?.constructor?.name === "Cohere" ||
    typeof client?.chat === "function"
  );
}
