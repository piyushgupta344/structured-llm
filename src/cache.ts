import type { z } from "zod";
import type { GenerateOptions, GenerateResult, ZodLike } from "./types.js";
import { generate } from "./generate.js";
import { resolveSchema } from "./schema/detect.js";

export interface CacheEntry<T> {
  data: T;
  usage: GenerateResult<T>["usage"];
  cachedAt: number;
  expiresAt: number;
}

export interface CacheStore {
  get(key: string): CacheEntry<unknown> | undefined;
  set(key: string, entry: CacheEntry<unknown>): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export interface WithCacheOptions {
  // TTL in milliseconds, default 5 minutes
  ttl?: number;
  // custom cache store (defaults to in-memory Map)
  store?: CacheStore;
  // custom key function — receives prompt/messages, model, and schema JSON
  keyFn?: (opts: { prompt?: string; messages?: unknown[]; model: string; schemaJson?: string }) => string;
  // if true, log cache hits/misses to console
  debug?: boolean;
}

export interface CachedGenerateResult<T> extends GenerateResult<T> {
  fromCache: boolean;
  cachedAt?: number;
}

// default in-memory store backed by a Map
function createMemoryStore(): CacheStore {
  const map = new Map<string, CacheEntry<unknown>>();
  return {
    get: (key) => map.get(key),
    set: (key, entry) => { map.set(key, entry); },
    delete: (key) => { map.delete(key); },
    clear: () => map.clear(),
    size: () => map.size,
  };
}

function defaultKey(opts: { prompt?: string; messages?: unknown[]; model: string; schemaJson?: string }): string {
  const input = opts.prompt ?? JSON.stringify(opts.messages ?? []);
  const schemaPart = opts.schemaJson ? `::${opts.schemaJson}` : "";
  return `${opts.model}::${input}${schemaPart}`;
}

// withCache wraps generate() with TTL-based memoization.
// Identical prompts + models return the cached result without hitting the LLM.
//
// Usage:
//   const cachedGenerate = withCache({ ttl: 60_000 });
//   const result = await cachedGenerate({ client, model, schema, prompt });
//   // second call with same prompt → fromCache: true, no API call

export function withCache(cacheOpts: WithCacheOptions = {}) {
  const { ttl = 5 * 60 * 1000, store = createMemoryStore(), keyFn = defaultKey, debug = false } = cacheOpts;

  return async function cachedGenerate<TSchema extends ZodLike>(
    opts: GenerateOptions<TSchema>
  ): Promise<CachedGenerateResult<z.infer<TSchema>>> {
    let schemaJson: string | undefined;
    try {
      schemaJson = JSON.stringify(resolveSchema(opts.schema).jsonSchema);
    } catch {
      // schema can't be resolved — skip it in the key
    }

    const key = keyFn({
      prompt: opts.prompt,
      messages: opts.messages,
      model: opts.model,
      schemaJson,
    });

    const now = Date.now();
    const cached = store.get(key);
    if (cached && cached.expiresAt > now) {
      if (debug) console.log(`[cache] HIT  ${key.slice(0, 60)}`);
      return {
        data: cached.data as z.infer<TSchema>,
        usage: cached.usage,
        fromCache: true,
        cachedAt: cached.cachedAt,
      };
    }

    if (debug) console.log(`[cache] MISS ${key.slice(0, 60)}`);
    const result = await generate(opts);

    store.set(key, {
      data: result.data,
      usage: result.usage,
      cachedAt: now,
      expiresAt: now + ttl,
    });

    return { ...result, fromCache: false };
  };
}

// createCacheStore exposes the memory store constructor for external use
// (e.g. if you want to share a store across multiple withCache instances)
export { createMemoryStore as createCacheStore };
