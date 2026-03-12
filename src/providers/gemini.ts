import type { AdapterRequest, AdapterResponse, ProviderAdapter } from "./types.js";
import { ProviderError } from "../errors.js";

export class GeminiAdapter implements ProviderAdapter {
  readonly name = "gemini" as const;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client: any) {
    this.client = client;
  }

  async complete(req: AdapterRequest): Promise<AdapterResponse> {
    const { model, messages, schema, schemaName, mode: rawMode, temperature, maxTokens, topP, seed, signal } = req;
    // Gemini doesn't support OpenAI-style strict JSON schema; fall back to tool-calling
    const mode = rawMode === "json-schema" ? "tool-calling" : rawMode;

    if (signal?.aborted) throw new ProviderError("gemini", "Request aborted");

    // Build content array for Gemini format
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages.filter((m) => m.role !== "system").map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const generationConfig = {
      temperature: temperature ?? 0,
      maxOutputTokens: maxTokens,
      topP,
      seed,
    };

    try {
      if (mode === "tool-calling") {
        const functionDeclaration = {
          name: schemaName,
          description: `Extract data matching the ${schemaName} schema`,
          parameters: cleanSchemaForGemini(schema),
        };

        const resp = await this.client.models.generateContent({
          model,
          contents: turns,
          config: {
            ...generationConfig,
            systemInstruction: systemMsg,
            tools: [{ functionDeclarations: [functionDeclaration] }],
            toolConfig: {
              functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: [schemaName],
              },
            },
          },
        });

        const candidate = resp.candidates?.[0];
        const fnCall = candidate?.content?.parts?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p.functionCall?.name === schemaName
        );
        if (!fnCall?.functionCall?.args) {
          throw new ProviderError("gemini", "No function call in response");
        }

        return {
          text: JSON.stringify(fnCall.functionCall.args),
          promptTokens: resp.usageMetadata?.promptTokenCount,
          completionTokens: resp.usageMetadata?.candidatesTokenCount,
        };
      }

      if (mode === "json-mode") {
        const resp = await this.client.models.generateContent({
          model,
          contents: turns,
          config: {
            ...generationConfig,
            systemInstruction: systemMsg,
            responseMimeType: "application/json",
            responseSchema: cleanSchemaForGemini(schema),
          },
        });

        const text = resp.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        return {
          text,
          promptTokens: resp.usageMetadata?.promptTokenCount,
          completionTokens: resp.usageMetadata?.candidatesTokenCount,
        };
      }

      // prompt-inject fallback
      const lastTurn = turns.at(-1);
      if (lastTurn) {
        const schemaInstructions = `\n\nRespond with ONLY valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`;
        lastTurn.parts[0].text += schemaInstructions;
      }

      const resp = await this.client.models.generateContent({
        model,
        contents: turns,
        config: { ...generationConfig, systemInstruction: systemMsg },
      });

      const text = resp.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return {
        text,
        promptTokens: resp.usageMetadata?.promptTokenCount,
        completionTokens: resp.usageMetadata?.candidatesTokenCount,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("gemini", e?.message ?? String(err), e?.status, err);
    }
  }

  async *stream(req: AdapterRequest): AsyncIterable<string> {
    const { model, messages, schema, schemaName, mode: rawMode, temperature, maxTokens, topP, seed, signal } = req;
    const mode = rawMode === "json-schema" ? "tool-calling" : rawMode;

    if (signal?.aborted) throw new ProviderError("gemini", "Request aborted");

    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages.filter((m) => m.role !== "system").map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    try {
      const config =
        mode === "json-mode"
          ? {
              temperature: temperature ?? 0,
              maxOutputTokens: maxTokens,
              topP,
              seed,
              systemInstruction: systemMsg,
              responseMimeType: "application/json",
              responseSchema: cleanSchemaForGemini(schema),
            }
          : mode === "tool-calling"
          ? {
              temperature: temperature ?? 0,
              maxOutputTokens: maxTokens,
              topP,
              seed,
              systemInstruction: systemMsg,
              tools: [{ functionDeclarations: [{ name: schemaName, parameters: cleanSchemaForGemini(schema) }] }],
              toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [schemaName] } },
            }
          : {
              temperature: temperature ?? 0,
              maxOutputTokens: maxTokens,
              topP,
              seed,
              systemInstruction: systemMsg,
            };

      const stream = await this.client.models.generateContentStream({ model, contents: turns, config });
      for await (const chunk of stream) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) yield text;
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      throw new ProviderError("gemini", e?.message ?? String(err), e?.status, err);
    }
  }
}

// Gemini is picky about JSON Schema — remove $schema, strip unsupported keywords
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanSchemaForGemini(schema: any): any {
  if (!schema || typeof schema !== "object") return schema;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { $schema, $defs, ...rest } = schema;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k === "properties" && typeof v === "object" && v !== null) {
      cleaned[k] = Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([pk, pv]) => [
          pk,
          cleanSchemaForGemini(pv),
        ])
      );
    } else if (k === "items") {
      cleaned[k] = cleanSchemaForGemini(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isGeminiClient(client: any): boolean {
  return (
    client?.constructor?.name === "GoogleGenAI" ||
    typeof client?.models?.generateContent === "function"
  );
}
