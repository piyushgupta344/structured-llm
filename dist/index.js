import { SchemaError, generate, MissingInputError, resolveSchema, resolveMode, adapterFromClient, adapterFromProvider, extractJSON, ValidationError, buildUsage, estimateTokens } from './chunk-XI3I6EK3.js';
export { MaxRetriesError, MissingInputError, ParseError, ProviderError, SchemaError, StructuredLLMError, UnsupportedProviderError, ValidationError, generate, getModelCapabilities, listSupportedModels, resolveMode, resolveSchema } from './chunk-XI3I6EK3.js';
import { z } from 'zod';

// src/generate-array.ts
async function generateArray(options) {
  let wrapperSchema;
  try {
    const { z: z3 } = await import('zod');
    wrapperSchema = z3.object({ items: z3.array(options.schema) });
  } catch {
    throw new SchemaError("zod must be available to use generateArray");
  }
  const { minItems, maxItems, prompt, systemPrompt, ...rest } = options;
  const arrayHint = [
    minItems != null ? `Include at least ${minItems} items.` : "",
    maxItems != null ? `Include at most ${maxItems} items.` : ""
  ].filter(Boolean).join(" ");
  const enhancedPrompt = prompt ? `${prompt}

Return the results as an array under the "items" key.${arrayHint ? " " + arrayHint : ""}` : void 0;
  const enhancedSystem = systemPrompt ? `${systemPrompt}
Always return an array of results under the "items" key.` : 'Return an array of results under the "items" key.';
  const result = await generate({
    ...rest,
    schema: wrapperSchema,
    prompt: enhancedPrompt,
    systemPrompt: enhancedSystem
  });
  const items = result.data.items ?? [];
  return {
    data: items,
    usage: result.usage
  };
}

// src/generate-stream.ts
function generateStream(options) {
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
    trackUsage = false
  } = options;
  if (!prompt && !messages?.length) throw new MissingInputError();
  const schemaAdapter = resolveSchema(schema);
  const resolvedMode = resolveMode(model, modeOverride);
  const builtMessages = buildStreamMessages(prompt, messages, systemPrompt, schemaAdapter.jsonSchema, resolvedMode);
  let resolveResult;
  let rejectResult;
  const resultPromise = new Promise((res, rej) => {
    resolveResult = res;
    rejectResult = rej;
  });
  const events = [];
  let done = false;
  let waiting = null;
  async function run() {
    const startTime = Date.now();
    let accumulated = "";
    try {
      const providerAdapter = client ? adapterFromClient(client) : await adapterFromProvider(provider, apiKey, baseURL);
      if (!providerAdapter.stream) {
        const resp = await providerAdapter.complete({
          model,
          messages: builtMessages,
          schema: schemaAdapter.jsonSchema,
          schemaName: "extract_structured_data",
          mode: resolvedMode,
          temperature,
          maxTokens
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
          maxTokens
        })) {
          accumulated += chunk;
          const partial = tryParsePartial(accumulated);
          if (partial !== null) {
            events.push({ partial, isDone: false });
            if (waiting) {
              waiting();
              waiting = null;
            }
          }
        }
      }
      const cleaned = extractJSON(accumulated);
      const parsed = JSON.parse(cleaned);
      const validation = schemaAdapter.safeParse(parsed);
      if (!validation.success) {
        throw new ValidationError([validation.error], accumulated, 1);
      }
      const usage = trackUsage ? buildUsage(
        model,
        providerAdapter.name,
        estimateTokens(builtMessages.map((m) => m.content).join(" ")),
        estimateTokens(accumulated),
        startTime,
        1
      ) : void 0;
      events.push({ partial: validation.data, isDone: true, usage });
      if (waiting) {
        waiting();
        waiting = null;
      }
      done = true;
      resolveResult({ data: validation.data, usage });
    } catch (err) {
      done = true;
      if (waiting) {
        waiting();
        waiting = null;
      }
      const e = err instanceof Error ? err : new Error(String(err));
      rejectResult(e);
    }
  }
  run();
  const iterable = {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          while (index >= events.length && !done) {
            await new Promise((r) => {
              waiting = r;
            });
          }
          if (index < events.length) {
            return { value: events[index++], done: false };
          }
          return { value: void 0, done: true };
        }
      };
    }
  };
  return Object.assign(iterable, { result: resultPromise });
}
function tryParsePartial(text) {
  try {
    const cleaned = extractJSON(text);
    return JSON.parse(cleaned);
  } catch {
    const partial = {};
    const kv = /["'](\w+)["']\s*:\s*([^,}\n]+)/g;
    let m;
    while ((m = kv.exec(text)) !== null) {
      try {
        partial[m[1]] = JSON.parse(m[2].trim());
      } catch {
        partial[m[1]] = m[2].trim().replace(/[",]/g, "");
      }
    }
    return Object.keys(partial).length > 0 ? partial : null;
  }
}
function buildStreamMessages(prompt, messages, systemPrompt, jsonSchema, mode) {
  const result = [];
  if (mode === "prompt-inject") {
    const schemaInstructions = `Respond with ONLY valid JSON matching this schema:
${JSON.stringify(jsonSchema, null, 2)}`;
    const sys = systemPrompt ? `${systemPrompt}

${schemaInstructions}` : schemaInstructions;
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

// src/generate-batch.ts
async function generateBatch(options) {
  const {
    inputs,
    concurrency = 3,
    continueOnError = true,
    onProgress,
    ...baseOptions
  } = options;
  const results = new Array(inputs.length);
  let completedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;
  for (let i = 0; i < inputs.length; i += concurrency) {
    const chunk = inputs.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (input, chunkIdx) => {
        const globalIdx = i + chunkIdx;
        const start = Date.now();
        try {
          const result = await generate({
            ...baseOptions,
            prompt: input.prompt,
            messages: input.messages,
            systemPrompt: input.systemPrompt ?? baseOptions.systemPrompt,
            temperature: input.temperature ?? baseOptions.temperature,
            maxRetries: input.maxRetries ?? baseOptions.maxRetries
          });
          results[globalIdx] = {
            index: globalIdx,
            input,
            data: result.data,
            usage: result.usage,
            durationMs: Date.now() - start
          };
          succeededCount++;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          results[globalIdx] = {
            index: globalIdx,
            input,
            error,
            durationMs: Date.now() - start
          };
          failedCount++;
          if (!continueOnError) throw error;
        }
        completedCount++;
        onProgress?.({
          completed: completedCount,
          total: inputs.length,
          succeeded: succeededCount,
          failed: failedCount,
          currentIndex: globalIdx
        });
      })
    );
  }
  const succeeded = results.filter((r) => !r.error);
  const failed = results.filter((r) => !!r.error);
  const usageItems = succeeded.filter((r) => r.usage);
  const totalUsage = usageItems.length > 0 ? {
    promptTokens: usageItems.reduce((s, r) => s + (r.usage?.promptTokens ?? 0), 0),
    completionTokens: usageItems.reduce((s, r) => s + (r.usage?.completionTokens ?? 0), 0),
    totalTokens: usageItems.reduce((s, r) => s + (r.usage?.totalTokens ?? 0), 0),
    estimatedCostUsd: usageItems.reduce((s, r) => s + (r.usage?.estimatedCostUsd ?? 0), 0),
    totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0)
  } : void 0;
  return { items: results, succeeded, failed, totalUsage };
}

// src/generate-multi-schema.ts
async function generateMultiSchema(options) {
  const { schemas, parallel = true, continueOnError = true, ...baseOpts } = options;
  const entries = Object.entries(schemas);
  async function runOne(label, schema) {
    const start = Date.now();
    try {
      const result = await generate({
        ...baseOpts,
        schema
      });
      return [label, { data: result.data, usage: result.usage, durationMs: Date.now() - start }];
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!continueOnError) throw error;
      return [label, { error, durationMs: Date.now() - start }];
    }
  }
  let pairs;
  if (parallel) {
    pairs = await Promise.all(entries.map(([label, schema]) => runOne(label, schema)));
  } else {
    pairs = [];
    for (const [label, schema] of entries) {
      pairs.push(await runOne(label, schema));
    }
  }
  const results = {};
  for (const [label, item] of pairs) {
    results[label] = item;
  }
  const usageItems = pairs.filter(([, r]) => r.usage);
  const totalUsage = usageItems.length > 0 ? {
    promptTokens: usageItems.reduce((s, [, r]) => s + (r.usage?.promptTokens ?? 0), 0),
    completionTokens: usageItems.reduce((s, [, r]) => s + (r.usage?.completionTokens ?? 0), 0),
    totalTokens: usageItems.reduce((s, [, r]) => s + (r.usage?.totalTokens ?? 0), 0),
    estimatedCostUsd: usageItems.reduce((s, [, r]) => s + (r.usage?.estimatedCostUsd ?? 0), 0)
  } : void 0;
  return { results, totalUsage };
}
async function classify(opts) {
  const {
    options,
    allowMultiple = false,
    includeConfidence = false,
    includeReasoning = false,
    prompt,
    messages,
    ...rest
  } = opts;
  const normalizedOptions = options.map(
    (o) => typeof o === "string" ? { value: o } : o
  );
  const optionList = normalizedOptions.map((o) => `  - "${o.value}"${o.description ? ` \u2014 ${o.description}` : ""}`).join("\n");
  const enumValues = normalizedOptions.map((o) => o.value);
  const schema = allowMultiple ? z.object({
    labels: z.array(z.enum(enumValues)).describe("All matching categories"),
    ...includeConfidence ? { confidence: z.number().min(0).max(1) } : {},
    ...includeReasoning ? { reasoning: z.string() } : {}
  }) : z.object({
    label: z.enum(enumValues),
    ...includeConfidence ? { confidence: z.number().min(0).max(1) } : {},
    ...includeReasoning ? { reasoning: z.string() } : {}
  });
  const classifySystem = [
    `Classify the input into ${allowMultiple ? "one or more" : "exactly one"} of these categories:`,
    optionList,
    includeConfidence ? "Include a confidence score from 0 (not confident) to 1 (very confident)." : "",
    includeReasoning ? "Include a brief one-sentence reasoning for your classification." : ""
  ].filter(Boolean).join("\n");
  const result = await generate({
    ...rest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema,
    prompt,
    messages,
    systemPrompt: rest.systemPrompt ? `${rest.systemPrompt}

${classifySystem}` : classifySystem
  });
  const data = result.data;
  const labels = allowMultiple ? data.labels ?? [] : [data.label];
  return {
    label: labels[0] ?? "",
    labels,
    confidence: data.confidence,
    reasoning: data.reasoning
  };
}
async function extract(opts) {
  const { fields, requireAll = false, ...rest } = opts;
  const schemaShape = {};
  for (const [key, spec] of Object.entries(fields)) {
    const def = typeof spec === "string" ? { type: spec } : spec;
    const isRequired = requireAll || def.required === true;
    let fieldSchema;
    if (def.options?.length) {
      fieldSchema = z.enum(def.options);
    } else {
      switch (def.type) {
        case "number":
          fieldSchema = z.number();
          break;
        case "integer":
          fieldSchema = z.number().int();
          break;
        case "boolean":
          fieldSchema = z.boolean();
          break;
        case "email":
          fieldSchema = z.string().email();
          break;
        case "url":
          fieldSchema = z.string().url();
          break;
        case "date":
          fieldSchema = z.string().describe("ISO 8601 date string");
          break;
        default:
          fieldSchema = z.string();
      }
    }
    if (def.description) {
      fieldSchema = fieldSchema.describe(def.description);
    }
    schemaShape[key] = isRequired ? fieldSchema : fieldSchema.optional();
  }
  const schema = z.object(schemaShape);
  const fieldDescriptions = Object.entries(fields).map(([key, spec]) => {
    const def = typeof spec === "string" ? { type: spec } : spec;
    return `- ${key} (${def.description ?? def.type})`;
  }).join("\n");
  const result = await generate({
    ...rest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema,
    systemPrompt: rest.systemPrompt ? rest.systemPrompt : `Extract the following fields from the provided text:
${fieldDescriptions}
If a field cannot be found, omit it.`
  });
  return result.data;
}

// src/client.ts
function createClient(clientOptions) {
  const { client, provider, apiKey, baseURL, model: defaultModel, defaultOptions = {} } = clientOptions;
  function mergeOptions(opts) {
    const resolvedModel = opts.model ?? defaultModel ?? "";
    return {
      client,
      provider,
      apiKey,
      baseURL,
      ...defaultOptions,
      ...opts,
      model: resolvedModel,
      hooks: mergeHooks(defaultOptions.hooks, opts.hooks)
    };
  }
  return {
    generate(opts) {
      return generate(mergeOptions(opts));
    },
    generateArray(opts) {
      return generateArray(mergeOptions(opts));
    },
    generateStream(opts) {
      return generateStream(mergeOptions(opts));
    },
    generateBatch(opts) {
      return generateBatch({ ...mergeOptions({ model: opts.model ?? defaultModel ?? "" }), ...opts });
    },
    classify(opts) {
      const resolvedModel = opts.model ?? defaultModel ?? "";
      return classify({
        client,
        provider,
        apiKey,
        baseURL,
        ...defaultOptions,
        ...opts,
        model: resolvedModel
      });
    },
    extract(opts) {
      const resolvedModel = opts.model ?? defaultModel ?? "";
      return extract({
        client,
        provider,
        apiKey,
        baseURL,
        ...defaultOptions,
        ...opts,
        model: resolvedModel
      });
    },
    generateMultiSchema(opts) {
      return generateMultiSchema({
        ...mergeOptions({ model: opts.model ?? defaultModel ?? "" }),
        ...opts
      });
    }
  };
}
function mergeHooks(global, local) {
  if (!global) return local;
  if (!local) return global;
  const keys = /* @__PURE__ */ new Set([...Object.keys(global), ...Object.keys(local)]);
  const merged = {};
  for (const key of keys) {
    const g = global[key];
    const l = local[key];
    if (g && l) {
      merged[key] = async (ctx) => {
        await g(ctx);
        await l(ctx);
      };
    } else {
      merged[key] = g ?? l;
    }
  }
  return merged;
}

// src/template.ts
function createTemplate(config) {
  const { template, ...generateConfig } = config;
  function render(vars) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in vars)) {
        throw new Error(`Template variable "{{${key}}}" not provided`);
      }
      return String(vars[key]);
    });
  }
  return {
    render,
    async run(vars, overrides = {}) {
      const prompt = render(vars);
      return generate({ ...generateConfig, ...overrides, prompt });
    },
    async runArray(vars, overrides = {}) {
      const prompt = render(vars);
      return generateArray({
        ...generateConfig,
        ...overrides,
        prompt
      });
    }
  };
}

// src/cache.ts
function createMemoryStore() {
  const map = /* @__PURE__ */ new Map();
  return {
    get: (key) => map.get(key),
    set: (key, entry) => {
      map.set(key, entry);
    },
    delete: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    size: () => map.size
  };
}
function defaultKey(opts) {
  const input = opts.prompt ?? JSON.stringify(opts.messages ?? []);
  return `${opts.model}::${input}`;
}
function withCache(cacheOpts = {}) {
  const { ttl = 5 * 60 * 1e3, store = createMemoryStore(), keyFn = defaultKey, debug = false } = cacheOpts;
  return async function cachedGenerate(opts) {
    const key = keyFn({
      prompt: opts.prompt,
      messages: opts.messages,
      model: opts.model
    });
    const now = Date.now();
    const cached = store.get(key);
    if (cached && cached.expiresAt > now) {
      if (debug) console.log(`[cache] HIT  ${key.slice(0, 60)}`);
      return {
        data: cached.data,
        usage: cached.usage,
        fromCache: true,
        cachedAt: cached.cachedAt
      };
    }
    if (debug) console.log(`[cache] MISS ${key.slice(0, 60)}`);
    const result = await generate(opts);
    store.set(key, {
      data: result.data,
      usage: result.usage,
      cachedAt: now,
      expiresAt: now + ttl
    });
    return { ...result, fromCache: false };
  };
}

export { classify, createMemoryStore as createCacheStore, createClient, createTemplate, extract, generateArray, generateBatch, generateMultiSchema, generateStream, withCache };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map