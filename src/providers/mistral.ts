import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";
import { ProviderError } from "../errors.js";

export class MistralAdapter implements ProviderAdapter {
  readonly name = "mistral" as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  async complete(req: AdapterRequest): Promise<AdapterResponse> {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;

    const mistralMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      if (mode === "tool-calling") {
        const resp = await this.client.chat.complete({
          model,
          messages: mistralMessages,
          temperature: temperature ?? 0,
          maxTokens,
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
          toolChoice: "any",
        });

        const toolCall = resp.choices?.[0]?.message?.toolCalls?.[0];
        if (!toolCall?.function?.arguments) {
          throw new ProviderError("mistral", "No tool call in response");
        }

        const args = toolCall.function.arguments;
        return {
          text: typeof args === "string" ? args : JSON.stringify(args),
          promptTokens: resp.usage?.promptTokens,
          completionTokens: resp.usage?.completionTokens,
        };
      }

      if (mode === "json-mode") {
        const resp = await this.client.chat.complete({
          model,
          messages: mistralMessages,
          temperature: temperature ?? 0,
          maxTokens,
          responseFormat: { type: "json_object" },
        });

        return {
          text: resp.choices?.[0]?.message?.content ?? "",
          promptTokens: resp.usage?.promptTokens,
          completionTokens: resp.usage?.completionTokens,
        };
      }

      const resp = await this.client.chat.complete({
        model,
        messages: mistralMessages,
        temperature: temperature ?? 0,
        maxTokens,
      });

      return {
        text: resp.choices?.[0]?.message?.content ?? "",
        promptTokens: resp.usage?.promptTokens,
        completionTokens: resp.usage?.completionTokens,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("mistral", e?.message ?? String(err), e?.statusCode, err);
    }
  }

  async *stream(req: AdapterRequest): AsyncIterable<string> {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const mistralMessages = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      if (mode === "tool-calling") {
        const stream = await this.client.chat.stream({
          model,
          messages: mistralMessages,
          temperature: temperature ?? 0,
          maxTokens,
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
          toolChoice: "any",
        });

        for await (const chunk of stream) {
          const delta = chunk.data?.choices?.[0]?.delta?.toolCalls?.[0]?.function?.arguments ?? "";
          if (delta) yield delta;
        }
        return;
      }

      const stream = await this.client.chat.stream({
        model,
        messages: mistralMessages,
        temperature: temperature ?? 0,
        maxTokens,
        ...(mode === "json-mode" ? { responseFormat: { type: "json_object" } } : {}),
      });

      for await (const chunk of stream) {
        const delta = chunk.data?.choices?.[0]?.delta?.content ?? "";
        if (delta) yield delta;
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("mistral", e?.message ?? String(err), e?.statusCode, err);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isMistralClient(client: any): boolean {
  return (
    client?.constructor?.name === "Mistral" ||
    typeof client?.chat?.complete === "function"
  );
}
