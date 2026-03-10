import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";
import type { ProviderName } from "../types.js";
import { ProviderError } from "../errors.js";

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
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;

    const oaiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      if (mode === "tool-calling") {
        const resp = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
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
        });

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
          response_format: { type: "json_object" },
        });

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
      });

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
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const oaiMessages = messages.map((m) => ({ role: m.role, content: m.content }));

    try {
      if (mode === "tool-calling") {
        const stream = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
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
        });

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
        ...(mode === "json-mode" ? { response_format: { type: "json_object" } } : {}),
        stream: true,
      });

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
