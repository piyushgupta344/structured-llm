import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";
import { ProviderError } from "../errors.js";

export class BedrockAdapter implements ProviderAdapter {
  readonly name = "bedrock" as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any; // BedrockRuntimeClient

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  async complete(req: AdapterRequest): Promise<AdapterResponse> {
    const { model, messages, schema, schemaName, mode: rawMode, temperature, maxTokens, topP, signal } = req;
    // Bedrock doesn't support OpenAI-style strict JSON schema; fall back to tool-calling
    const mode = rawMode === "json-schema" ? "tool-calling" : rawMode;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ConverseCommand: any;
    try {
      ({ ConverseCommand } = await import("@aws-sdk/client-bedrock-runtime"));
    } catch {
      throw new ProviderError("bedrock", "@aws-sdk/client-bedrock-runtime is required. Install it: npm install @aws-sdk/client-bedrock-runtime");
    }

    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: [{ text: m.content }],
      }));

    const toolConfig =
      mode === "tool-calling"
        ? {
            tools: [
              {
                toolSpec: {
                  name: schemaName,
                  description: `Extract data matching the ${schemaName} schema`,
                  inputSchema: { json: schema as Record<string, unknown> },
                },
              },
            ],
            toolChoice: { tool: { name: schemaName } },
          }
        : undefined;

    // For non-tool-calling, inject schema into system prompt
    const baseSystem = systemMsg ? [{ text: systemMsg }] : [];
    const finalSystem =
      mode !== "tool-calling"
        ? [
            ...baseSystem,
            {
              text: `Respond with ONLY valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include markdown or any text outside the JSON.`,
            },
          ]
        : baseSystem.length > 0
        ? baseSystem
        : undefined;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendOpts: any = signal ? { abortSignal: signal } : undefined;
      const resp = await this.client.send(
        new ConverseCommand({
          modelId: model,
          messages: turns,
          system: finalSystem,
          toolConfig,
          inferenceConfig: {
            temperature: temperature ?? 0,
            maxTokens: maxTokens ?? 4096,
            topP,
          },
        }),
        sendOpts
      );

      if (mode === "tool-calling") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolUse = resp.output?.message?.content?.find((b: any) => b.toolUse?.name === schemaName);
        if (!toolUse?.toolUse?.input) {
          throw new ProviderError("bedrock", "No tool use block in response");
        }
        return {
          text: JSON.stringify(toolUse.toolUse.input),
          promptTokens: resp.usage?.inputTokens,
          completionTokens: resp.usage?.outputTokens,
        };
      }

      const text = resp.output?.message?.content?.[0]?.text ?? "";
      return {
        text,
        promptTokens: resp.usage?.inputTokens,
        completionTokens: resp.usage?.outputTokens,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("bedrock", e?.message ?? String(err), e?.$metadata?.httpStatusCode, err);
    }
  }

  async *stream(req: AdapterRequest): AsyncIterable<string> {
    const { model, messages, schema, schemaName, mode: rawMode, temperature, maxTokens, topP, signal } = req;
    const mode = rawMode === "json-schema" ? "tool-calling" : rawMode;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ConverseStreamCommand: any;
    try {
      ({ ConverseStreamCommand } = await import("@aws-sdk/client-bedrock-runtime"));
    } catch {
      throw new ProviderError("bedrock", "@aws-sdk/client-bedrock-runtime is required. Install it: npm install @aws-sdk/client-bedrock-runtime");
    }

    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: [{ text: m.content }],
      }));

    const toolConfig =
      mode === "tool-calling"
        ? {
            tools: [
              {
                toolSpec: {
                  name: schemaName,
                  description: `Extract data matching the ${schemaName} schema`,
                  inputSchema: { json: schema as Record<string, unknown> },
                },
              },
            ],
            toolChoice: { tool: { name: schemaName } },
          }
        : undefined;

    const baseSystem = systemMsg ? [{ text: systemMsg }] : [];
    const finalSystem =
      mode !== "tool-calling"
        ? [
            ...baseSystem,
            { text: `Respond with ONLY valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}` },
          ]
        : baseSystem.length > 0
        ? baseSystem
        : undefined;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sendOpts: any = signal ? { abortSignal: signal } : undefined;
      const resp = await this.client.send(
        new ConverseStreamCommand({
          modelId: model,
          messages: turns,
          system: finalSystem,
          toolConfig,
          inferenceConfig: {
            temperature: temperature ?? 0,
            maxTokens: maxTokens ?? 4096,
            topP,
          },
        }),
        sendOpts
      );

      if (!resp.stream) return;

      for await (const event of resp.stream) {
        if (mode === "tool-calling") {
          const delta = event.contentBlockDelta?.delta?.toolUse?.input ?? "";
          if (delta) yield delta;
        } else {
          const delta = event.contentBlockDelta?.delta?.text ?? "";
          if (delta) yield delta;
        }
      }
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("bedrock", e?.message ?? String(err), e?.$metadata?.httpStatusCode, err);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isBedrockClient(client: any): boolean {
  return client?.constructor?.name === "BedrockRuntimeClient";
}
