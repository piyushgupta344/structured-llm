# withCache()

Wrap `generate()` with TTL-based memoization. Identical prompts + model + schema return the cached result without hitting the LLM.

```typescript
import { withCache } from "structured-llm";

const cachedGenerate = withCache({ ttl: 60_000 }); // cache for 1 minute

const result1 = await cachedGenerate({ client: openai, model: "gpt-4o-mini", schema, prompt });
// → hits the API

const result2 = await cachedGenerate({ client: openai, model: "gpt-4o-mini", schema, prompt });
// → fromCache: true, no API call
```

## Options

```typescript
interface WithCacheOptions {
  ttl?: number;    // time-to-live in milliseconds, default: 300_000 (5 minutes)
  store?: CacheStore;  // custom cache backend, default: in-memory Map
  keyFn?: (opts: {
    prompt?: string;
    messages?: unknown[];
    model: string;
    schemaJson?: string;
  }) => string;
  debug?: boolean; // log HIT/MISS to console, default: false
}
```

## Return value

The wrapped function returns `CachedGenerateResult`:

```typescript
interface CachedGenerateResult<T> extends GenerateResult<T> {
  data: T;
  usage?: UsageInfo;
  fromCache: boolean;    // true if served from cache
  cachedAt?: number;     // timestamp when the entry was cached
}
```

## Cache key

By default the cache key is `{model}::{prompt|messages}::{schemaJson}`. This means:
- Different schemas for the same prompt are cached separately
- Changing the model busts the cache
- The schema JSON is included so the same prompt + different schemas don't collide

## Examples

### Basic in-memory cache

```typescript
import { withCache } from "structured-llm";

const cachedGenerate = withCache({ ttl: 5 * 60 * 1000 }); // 5 minutes

const { data, fromCache } = await cachedGenerate({
  client: openai,
  model: "gpt-4o-mini",
  schema: SentimentSchema,
  prompt: reviewText,
});

console.log(fromCache ? "cache hit" : "fresh call");
```

### Shared across your app

```typescript
// lib/llm.ts
import OpenAI from "openai";
import { withCache } from "structured-llm";

const openai = new OpenAI();

export const cachedGenerate = withCache({
  ttl: 10 * 60 * 1000, // 10 minutes
  debug: process.env.NODE_ENV === "development",
});
```

### Custom cache store (e.g. Redis)

```typescript
import { withCache, createCacheStore } from "structured-llm";
import type { CacheStore, CacheEntry } from "structured-llm";

function createRedisStore(redis: RedisClient): CacheStore {
  return {
    get(key: string) {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as CacheEntry<unknown>) : undefined;
    },
    set(key: string, entry: CacheEntry<unknown>) {
      const ttlSec = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      await redis.setex(key, ttlSec, JSON.stringify(entry));
    },
    delete(key: string) {
      await redis.del(key);
    },
    clear() {
      // implement if needed
    },
    size() {
      return 0; // optional
    },
  };
}

const cachedGenerate = withCache({
  ttl: 60_000,
  store: createRedisStore(redisClient),
});
```

### Custom cache key

```typescript
const cachedGenerate = withCache({
  ttl: 60_000,
  keyFn: ({ prompt, model, schemaJson }) => {
    // normalize whitespace so minor formatting changes don't bust the cache
    const normalized = prompt?.replace(/\s+/g, " ").trim() ?? "";
    return `${model}::${normalized}::${schemaJson ?? ""}`;
  },
});
```

### Check cache metadata

```typescript
const result = await cachedGenerate({ ... });

if (result.fromCache) {
  const ageMs = Date.now() - (result.cachedAt ?? 0);
  console.log(`Served from cache (${Math.round(ageMs / 1000)}s old)`);
}
```

## createCacheStore()

`createCacheStore()` exposes the default in-memory store constructor so you can share one store across multiple `withCache` instances:

```typescript
import { withCache, createCacheStore } from "structured-llm";

const sharedStore = createCacheStore();

const cachedSentiment = withCache({ store: sharedStore, ttl: 60_000 });
const cachedSummary   = withCache({ store: sharedStore, ttl: 60_000 });

// Both share the same in-memory Map
console.log(sharedStore.size()); // combined entry count
sharedStore.clear();              // clear all cached entries at once
```

## Notes

- The cache is entirely in-process by default — it does **not** persist across restarts or share between server instances. Use a `CacheStore` backed by Redis or a database for multi-instance deployments.
- `withCache` only wraps `generate()`. For caching `generateArray` or `generateBatch`, pass the array/batch prompt as a regular `generate()` call or implement caching at a higher layer.
