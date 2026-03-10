import type { z } from "zod";
import type {
  GenerateOptions,
  GenerateResult,
  Hooks,
  Message,
  ProviderName,
  ZodLike,
} from "./types.js";
import { resolveSchema } from "./schema/detect.js";
import { adapterFromClient, adapterFromProvider } from "./providers/registry.js";
import { resolveMode } from "./models.js";
import { buildUsage } from "./usage.js";
import { buildRetryMessage, extractJSON, retryDelay, sleep } from "./retry.js";
import { emitError, emitRequest, emitResponse, emitRetry, emitSuccess } from "./hooks.js";
import {
  MissingInputError,
  MaxRetriesError,
  ParseError,
  ValidationError,
} from "./errors.js";
import type { ProviderAdapter } from "./providers/types.js";

export async function generate<TSchema extends ZodLike>(
  options: GenerateOptions<TSchema>
): Promise<GenerateResult<z.infer<TSchema>>> {
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
    maxRetries = 3,
    retryOptions,
    temperature = 0,
    maxTokens,
    trackUsage = false,
    hooks,
    fallbackChain,
  } = options;

  if (!prompt && !messages?.length) throw new MissingInputError();

  // Resolve schema adapter
  const adapter = resolveSchema<z.infer<TSchema>>(schema);

  // Build initial messages list
  const builtMessages = buildMessages(prompt, messages, systemPrompt, adapter.jsonSchema, modeOverride ?? "auto", model);

  // Try the primary target first, then fallbacks
  const targets = buildTargets(client, provider, apiKey, baseURL, fallbackChain);

  const startTime = Date.now();
  let lastError: Error = new Error("Unknown error");

  for (const target of targets) {
    try {
      const providerAdapter = await resolveAdapter(target);
      const resolvedMode = resolveMode(model, modeOverride);
      const schemaName = getSchemaName(schema);

      const result = await runWithRetry({
        adapter: providerAdapter,
        schemaAdapter: adapter,
        messages: builtMessages,
        model,
        schemaName,
        mode: resolvedMode,
        temperature,
        maxTokens,
        maxRetries,
        retryOptions,
        hooks: hooks as Hooks | undefined,
        startTime,
        trackUsage,
      });

      return result as GenerateResult<z.infer<TSchema>>;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // only continue to next fallback on provider/network errors
      // don't swallow validation errors
      if (err instanceof ValidationError || err instanceof MaxRetriesError) {
        throw err;
      }
    }
  }

  throw lastError;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface RunWithRetryOptions {
  adapter: ProviderAdapter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaAdapter: ReturnType<typeof resolveSchema<any>>;
  messages: Message[];
  model: string;
  schemaName: string;
  mode: ReturnType<typeof resolveMode>;
  temperature: number;
  maxTokens?: number;
  maxRetries: number;
  retryOptions?: GenerateOptions<ZodLike>["retryOptions"];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hooks?: GenerateOptions<ZodLike>["hooks"];
  startTime: number;
  trackUsage: boolean;
}

async function runWithRetry<T>(opts: RunWithRetryOptions): Promise<GenerateResult<T>> {
  const {
    adapter,
    schemaAdapter,
    model,
    schemaName,
    mode,
    temperature,
    maxTokens,
    maxRetries,
    retryOptions,
    hooks,
    startTime,
    trackUsage,
  } = opts;

  let currentMessages = [...opts.messages];
  let promptTokens = 0;
  let completionTokens = 0;
  let lastRaw = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await emitRequest(hooks, currentMessages, model, adapter.name, attempt + 1);

    const resp = await adapter.complete({
      model,
      messages: currentMessages,
      schema: schemaAdapter.jsonSchema,
      schemaName,
      mode,
      temperature,
      maxTokens,
    });

    lastRaw = resp.text;
    promptTokens += resp.promptTokens ?? 0;
    completionTokens += resp.completionTokens ?? 0;

    await emitResponse(hooks, lastRaw, attempt + 1, model);

    // Try to parse the response
    let parsed: unknown;
    try {
      const cleaned = extractJSON(lastRaw);
      parsed = JSON.parse(cleaned);
    } catch {
      if (attempt >= maxRetries) {
        const err = new ParseError(lastRaw, attempt + 1);
        await emitError(hooks, err, attempt + 1);
        throw err;
      }
      await emitRetry(hooks, attempt + 1, maxRetries, "Invalid JSON", model);
      const delay = retryDelay(attempt + 1, retryOptions);
      if (delay > 0) await sleep(delay);

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: lastRaw },
        {
          role: "user",
          content: buildRetryMessage(attempt + 1, maxRetries, "parse", "", lastRaw),
        },
      ];
      continue;
    }

    // Validate against schema
    const validation = schemaAdapter.safeParse(parsed);
    if (validation.success) {
      const usage = trackUsage
        ? buildUsage(model, adapter.name, promptTokens, completionTokens, startTime, attempt + 1)
        : undefined;
      await emitSuccess(hooks, validation.data, usage);
      return { data: validation.data as T, usage };
    }

    if (attempt >= maxRetries) {
      const err = new ValidationError(
        typeof validation.error === "string" ? [validation.error] : [validation.error],
        lastRaw,
        attempt + 1
      );
      await emitError(hooks, err, attempt + 1);
      throw err;
    }

    await emitRetry(hooks, attempt + 1, maxRetries, validation.error, model);
    const delay = retryDelay(attempt + 1, retryOptions);
    if (delay > 0) await sleep(delay);

    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: lastRaw },
      {
        role: "user",
        content: buildRetryMessage(
          attempt + 1,
          maxRetries,
          "validation",
          validation.error,
          lastRaw
        ),
      },
    ];
  }

  throw new MaxRetriesError(maxRetries, lastRaw.slice(0, 200));
}

function buildMessages(
  prompt: string | undefined,
  messages: Message[] | undefined,
  systemPrompt: string | undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jsonSchema: any,
  mode: string,
  model: string
): Message[] {
  const result: Message[] = [];

  // System message
  const resolvedMode = resolveMode(model, mode);
  if (resolvedMode === "prompt-inject") {
    // embed schema in system message for prompt-inject mode
    const schemaInstructions = `Respond with ONLY valid JSON (no markdown, no explanation) matching this JSON Schema:\n${JSON.stringify(jsonSchema, null, 2)}`;
    const sys = systemPrompt ? `${systemPrompt}\n\n${schemaInstructions}` : schemaInstructions;
    result.push({ role: "system", content: sys });
  } else if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }

  if (messages?.length) {
    // If messages already have a system message, don't add another
    const hasSystem = messages.some((m) => m.role === "system");
    if (hasSystem) {
      return messages;
    }
    result.push(...messages);
  }

  if (prompt) {
    result.push({ role: "user", content: prompt });
  }

  return result;
}

interface TargetSpec {
  client?: unknown;
  provider?: ProviderName;
  apiKey?: string;
  baseURL?: string;
}

function buildTargets(
  client?: unknown,
  provider?: ProviderName,
  apiKey?: string,
  baseURL?: string,
  fallbackChain?: GenerateOptions<ZodLike>["fallbackChain"]
): TargetSpec[] {
  const primary: TargetSpec = client ? { client } : { provider, apiKey, baseURL };
  const fallbacks = fallbackChain ?? [];
  return [primary, ...fallbacks];
}

async function resolveAdapter(target: TargetSpec): Promise<ProviderAdapter> {
  if (target.client) return adapterFromClient(target.client);
  if (target.provider) return adapterFromProvider(target.provider, target.apiKey, target.baseURL);
  throw new Error("Target must have client or provider");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSchemaName(schema: any): string {
  // Zod v4 has schema.description, older versions have _def.description
  return (
    schema?.description ??
    schema?._def?.description ??
    "extract_structured_data"
  );
}
