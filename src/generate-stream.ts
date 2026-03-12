import type { z } from "zod";
import type {
  GenerateStreamOptions,
  Hooks,
  StreamEvent,
  UsageInfo,
  ZodLike,
} from "./types.js";
import { resolveSchema } from "./schema/detect.js";
import { adapterFromClient, adapterFromProvider } from "./providers/registry.js";
import { resolveMode } from "./models.js";
import { buildUsage, estimateTokens } from "./usage.js";
import { extractJSON, retryDelay, sleep } from "./retry.js";
import { MissingInputError, ParseError, ProviderError, ValidationError } from "./errors.js";
import { emitChunk, emitError, emitRequest, emitResponse, emitRetry, emitSuccess } from "./hooks.js";
import type { Message } from "./types.js";

function isRetryableStatus(statusCode?: number): boolean {
  return statusCode === 429 || statusCode === 502 || statusCode === 503 || statusCode === 529;
}

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
    topP,
    seed,
    signal,
    maxRetries = 3,
    retryOptions,
    trackUsage = false,
    hooks,
  } = options;

  if (!prompt && !messages?.length) throw new MissingInputError();

  const schemaAdapter = resolveSchema<z.infer<TSchema>>(schema);
  const resolvedMode = resolveMode(model, modeOverride);
  const builtMessages = buildStreamMessages(prompt, messages, systemPrompt, schemaAdapter.jsonSchema, resolvedMode);

  let resolveResult!: (v: { data: z.infer<TSchema>; usage?: UsageInfo }) => void;
  let rejectResult!: (e: Error) => void;
  const resultPromise = new Promise<{ data: z.infer<TSchema>; usage?: UsageInfo }>((res, rej) => {
    resolveResult = res;
    rejectResult = rej;
  });

  const events: StreamEvent<z.infer<TSchema>>[] = [];
  let done = false;
  let waiting: (() => void) | null = null;

  function notify() {
    if (waiting) { waiting(); waiting = null; }
  }

  async function run() {
    const startTime = Date.now();

    try {
      const providerAdapter = client
        ? adapterFromClient(client)
        : await adapterFromProvider(provider!, apiKey, baseURL);

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Snapshot event count so we can roll back on retry
        const eventsAtStart = events.length;

        await emitRequest(hooks, builtMessages, model, providerAdapter.name, attempt + 1);

        let accumulated = "";

        try {
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
              topP,
              seed,
              signal,
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
              topP,
              seed,
              signal,
            })) {
              accumulated += chunk;

              // Emit partial — try to parse what we have so far
              const partial = tryParsePartial<z.infer<TSchema>>(accumulated);
              if (partial !== null) {
                events.push({ partial, isDone: false });
                notify();
                await emitChunk(hooks as Hooks, partial, model);
              }
            }
          }
        } catch (err) {
          // Roll back any partial events from this attempt before retrying
          events.splice(eventsAtStart);

          if (err instanceof ProviderError && isRetryableStatus(err.statusCode) && attempt < maxRetries) {
            await emitRetry(hooks, attempt + 1, maxRetries, err.message, model);
            const delay = retryDelay(attempt + 1, retryOptions ?? { strategy: "exponential", baseDelayMs: 1000 });
            if (delay > 0) await sleep(delay);
            continue;
          }

          const e = err instanceof Error ? err : new Error(String(err));
          await emitError(hooks, e, attempt + 1);
          done = true;
          notify();
          rejectResult(e);
          return;
        }

        await emitResponse(hooks, accumulated, attempt + 1, model);

        // Final parse + validate
        let parsed: unknown;
        try {
          const cleaned = extractJSON(accumulated);
          parsed = JSON.parse(cleaned);
        } catch {
          const err = new ParseError(accumulated, attempt + 1);
          await emitError(hooks, err, attempt + 1);
          done = true;
          notify();
          rejectResult(err);
          return;
        }

        const validation = schemaAdapter.safeParse(parsed);
        if (!validation.success) {
          const err = new ValidationError([validation.error], accumulated, attempt + 1);
          await emitError(hooks, err, attempt + 1);
          done = true;
          notify();
          rejectResult(err);
          return;
        }

        const usage = trackUsage
          ? buildUsage(
              model,
              providerAdapter.name,
              estimateTokens(builtMessages.map((m) => m.content).join(" ")),
              estimateTokens(accumulated),
              startTime,
              attempt + 1
            )
          : undefined;

        await emitSuccess(hooks, validation.data, usage);
        events.push({ partial: validation.data, isDone: true, usage });
        notify();
        done = true;
        resolveResult({ data: validation.data, usage });
        return;
      }
    } catch (err) {
      done = true;
      notify();
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
    if (hasSystem) {
      // Still append prompt as a user message if provided
      if (prompt) return [...messages, { role: "user", content: prompt }];
      return messages;
    }
    result.push(...messages);
  }
  if (prompt) result.push({ role: "user", content: prompt });

  return result;
}
