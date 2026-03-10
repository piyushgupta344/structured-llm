import type { z } from "zod";
import type {
  GenerateStreamOptions,
  StreamEvent,
  UsageInfo,
  ZodLike,
} from "./types.js";
import { resolveSchema } from "./schema/detect.js";
import { adapterFromClient, adapterFromProvider } from "./providers/registry.js";
import { resolveMode } from "./models.js";
import { buildUsage, estimateTokens } from "./usage.js";
import { extractJSON } from "./retry.js";
import { MissingInputError, ValidationError } from "./errors.js";
import type { Message } from "./types.js";

// Returns an async iterable of StreamEvents (partial objects as they stream in)
// plus a .result promise that resolves when streaming is complete and validated.
export function generateStream<TSchema extends ZodLike>(
  options: GenerateStreamOptions<TSchema>
): AsyncIterable<StreamEvent<z.infer<TSchema>>> & {
  result: Promise<{ data: z.infer<TSchema>; usage?: UsageInfo }>;
} {
  const {
    client,
    provider,
    apiKey,
    baseURL,
    model,
    schema,
    prompt,
    messages,
    systemPrompt,
    mode: modeOverride,
    temperature = 0,
    maxTokens,
    trackUsage = false,
  } = options;

  if (!prompt && !messages?.length) throw new MissingInputError();

  const schemaAdapter = resolveSchema<z.infer<TSchema>>(schema);
  const resolvedMode = resolveMode(model, modeOverride);

  const builtMessages = buildStreamMessages(prompt, messages, systemPrompt, schemaAdapter.jsonSchema, resolvedMode);

  // We need to return an object that is both async iterable AND has a .result promise.
  // We use a shared state approach with a queue.
  let resolveResult!: (v: { data: z.infer<TSchema>; usage?: UsageInfo }) => void;
  let rejectResult!: (e: Error) => void;
  const resultPromise = new Promise<{ data: z.infer<TSchema>; usage?: UsageInfo }>((res, rej) => {
    resolveResult = res;
    rejectResult = rej;
  });

  const events: StreamEvent<z.infer<TSchema>>[] = [];
  let done = false;
  let waiting: (() => void) | null = null;

  async function run() {
    const startTime = Date.now();
    let accumulated = "";

    try {
      const providerAdapter = client
        ? adapterFromClient(client)
        : await adapterFromProvider(provider!, apiKey, baseURL);

      if (!providerAdapter.stream) {
        // Provider doesn't support streaming — fall back to complete()
        const resp = await providerAdapter.complete({
          model,
          messages: builtMessages,
          schema: schemaAdapter.jsonSchema,
          schemaName: "extract_structured_data",
          mode: resolvedMode,
          temperature,
          maxTokens,
        });
        accumulated = resp.text;
      } else {
        for await (const chunk of providerAdapter.stream({
          model,
          messages: builtMessages,
          schema: schemaAdapter.jsonSchema,
          schemaName: "extract_structured_data",
          mode: resolvedMode,
          temperature,
          maxTokens,
        })) {
          accumulated += chunk;

          // Emit partial — try to parse what we have so far
          const partial = tryParsePartial<z.infer<TSchema>>(accumulated);
          if (partial !== null) {
            events.push({ partial, isDone: false });
            if (waiting) { waiting(); waiting = null; }
          }
        }
      }

      // Final parse + validate
      const cleaned = extractJSON(accumulated);
      const parsed = JSON.parse(cleaned);
      const validation = schemaAdapter.safeParse(parsed);
      if (!validation.success) {
        throw new ValidationError([validation.error], accumulated, 1);
      }

      const usage = trackUsage
        ? buildUsage(
            model,
            providerAdapter.name,
            estimateTokens(builtMessages.map((m) => m.content).join(" ")),
            estimateTokens(accumulated),
            startTime,
            1
          )
        : undefined;

      events.push({ partial: validation.data, isDone: true, usage });
      if (waiting) { waiting(); waiting = null; }
      done = true;

      resolveResult({ data: validation.data, usage });
    } catch (err) {
      done = true;
      if (waiting) { waiting(); waiting = null; }
      const e = err instanceof Error ? err : new Error(String(err));
      rejectResult(e);
    }
  }

  run();

  const iterable: AsyncIterable<StreamEvent<z.infer<TSchema>>> = {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          while (index >= events.length && !done) {
            await new Promise<void>((r) => { waiting = r; });
          }
          if (index < events.length) {
            return { value: events[index++], done: false };
          }
          return { value: undefined as unknown as StreamEvent<z.infer<TSchema>>, done: true };
        },
      };
    },
  };

  return Object.assign(iterable, { result: resultPromise });
}

function tryParsePartial<T>(text: string): Partial<T> | null {
  try {
    const cleaned = extractJSON(text);
    return JSON.parse(cleaned) as Partial<T>;
  } catch {
    // build a partial from what we can see — look for "key": value patterns
    const partial: Record<string, unknown> = {};
    const kv = /["'](\w+)["']\s*:\s*([^,}\n]+)/g;
    let m: RegExpExecArray | null;
    while ((m = kv.exec(text)) !== null) {
      try {
        partial[m[1]] = JSON.parse(m[2].trim());
      } catch {
        partial[m[1]] = m[2].trim().replace(/[",]/g, "");
      }
    }
    return Object.keys(partial).length > 0 ? (partial as Partial<T>) : null;
  }
}

function buildStreamMessages(
  prompt: string | undefined,
  messages: Message[] | undefined,
  systemPrompt: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonSchema: any,
  mode: string
): Message[] {
  const result: Message[] = [];

  if (mode === "prompt-inject") {
    const schemaInstructions = `Respond with ONLY valid JSON matching this schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
    const sys = systemPrompt ? `${systemPrompt}\n\n${schemaInstructions}` : schemaInstructions;
    result.push({ role: "system", content: sys });
  } else if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  if (messages?.length) {
    const hasSystem = messages.some((m) => m.role === "system");
    if (hasSystem) return messages;
    result.push(...messages);
  }
  if (prompt) result.push({ role: "user", content: prompt });

  return result;
}
