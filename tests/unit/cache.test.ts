import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { withCache, createCacheStore } from "../../src/cache.js";
import { mockOpenAIClient } from "../fixtures/mock-clients.js";

const SimpleSchema = z.object({ label: z.string() });
const response = JSON.stringify({ label: "test" });

describe("withCache", () => {
  it("returns fromCache: false on first call", async () => {
    const client = mockOpenAIClient(response, { toolCall: true });
    const cachedGenerate = withCache({ ttl: 60_000 });

    const result = await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "hello" });
    expect(result.fromCache).toBe(false);
  });

  it("returns fromCache: true on repeated identical call", async () => {
    const client = mockOpenAIClient(response, { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;
    const cachedGenerate = withCache({ ttl: 60_000 });

    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "same prompt" });
    const result2 = await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "same prompt" });

    expect(result2.fromCache).toBe(true);
    expect(create).toHaveBeenCalledTimes(1); // only one real API call
  });

  it("does not cache when prompts differ", async () => {
    const client = mockOpenAIClient(response, { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;
    const cachedGenerate = withCache({ ttl: 60_000 });

    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "prompt A" });
    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "prompt B" });

    expect(create).toHaveBeenCalledTimes(2);
  });

  it("does not cache when models differ", async () => {
    const client = mockOpenAIClient(response, { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;
    const cachedGenerate = withCache({ ttl: 60_000 });

    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "same" });
    await cachedGenerate({ client, model: "gpt-4o", schema: SimpleSchema, prompt: "same" });

    expect(create).toHaveBeenCalledTimes(2);
  });

  it("respects TTL — expired entries trigger new API call", async () => {
    const client = mockOpenAIClient(response, { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;
    const cachedGenerate = withCache({ ttl: 1 }); // 1ms TTL

    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "test" });
    await new Promise((r) => setTimeout(r, 10)); // wait for TTL to expire
    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "test" });

    expect(create).toHaveBeenCalledTimes(2);
  });

  it("uses custom store", async () => {
    const store = createCacheStore();
    const client = mockOpenAIClient(response, { toolCall: true });
    const cachedGenerate = withCache({ store, ttl: 60_000 });

    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "check store" });
    expect(store.size()).toBe(1);

    store.clear();
    expect(store.size()).toBe(0);
  });

  it("uses custom key function", async () => {
    const client = mockOpenAIClient(response, { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;

    // Key ignores model — same prompt across models shares cache
    const cachedGenerate = withCache({
      ttl: 60_000,
      keyFn: ({ prompt }) => prompt ?? "",
    });

    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "same" });
    const r2 = await cachedGenerate({ client, model: "gpt-4o", schema: SimpleSchema, prompt: "same" });

    expect(r2.fromCache).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("cached result contains cachedAt timestamp", async () => {
    const client = mockOpenAIClient(response, { toolCall: true });
    const cachedGenerate = withCache({ ttl: 60_000 });

    await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "ts test" });
    const r2 = await cachedGenerate({ client, model: "gpt-4o-mini", schema: SimpleSchema, prompt: "ts test" });

    expect(r2.fromCache).toBe(true);
    expect(r2.cachedAt).toBeTypeOf("number");
    expect(r2.cachedAt!).toBeLessThanOrEqual(Date.now());
  });
});

describe("createCacheStore", () => {
  it("supports get/set/delete/clear/size", () => {
    const store = createCacheStore();
    const entry = { data: "x", usage: undefined, cachedAt: Date.now(), expiresAt: Date.now() + 1000 };

    store.set("key1", entry);
    expect(store.size()).toBe(1);
    expect(store.get("key1")).toEqual(entry);

    store.delete("key1");
    expect(store.size()).toBe(0);
    expect(store.get("key1")).toBeUndefined();

    store.set("a", entry);
    store.set("b", entry);
    store.clear();
    expect(store.size()).toBe(0);
  });
});
