import { describe, it, expect, vi } from "vitest";
import { emitRequest, emitRetry, emitSuccess, emitError, emitResponse } from "../../src/hooks.js";

describe("hook emitters", () => {
  it("emitRequest calls onRequest hook", async () => {
    const onRequest = vi.fn();
    await emitRequest(
      { onRequest },
      [{ role: "user", content: "test" }],
      "gpt-4o-mini",
      "openai",
      1
    );
    expect(onRequest).toHaveBeenCalledOnce();
    expect(onRequest.mock.calls[0][0]).toMatchObject({
      model: "gpt-4o-mini",
      provider: "openai",
      attempt: 1,
    });
  });

  it("emitResponse calls onResponse hook", async () => {
    const onResponse = vi.fn();
    await emitResponse({ onResponse }, '{"result":"ok"}', 1, "gpt-4o");
    expect(onResponse).toHaveBeenCalledOnce();
    expect(onResponse.mock.calls[0][0].rawResponse).toBe('{"result":"ok"}');
  });

  it("emitRetry calls onRetry hook", async () => {
    const onRetry = vi.fn();
    await emitRetry({ onRetry }, 2, 3, "Invalid JSON", "gpt-4o-mini");
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry.mock.calls[0][0]).toMatchObject({ attempt: 2, maxRetries: 3 });
  });

  it("emitSuccess calls onSuccess with result", async () => {
    const onSuccess = vi.fn();
    const result = { sentiment: "positive", score: 0.9 };
    await emitSuccess({ onSuccess }, result);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess.mock.calls[0][0].result).toBe(result);
  });

  it("emitError calls onError hook", async () => {
    const onError = vi.fn();
    const err = new Error("something failed");
    await emitError({ onError }, err, 3);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].error).toBe(err);
    expect(onError.mock.calls[0][0].allAttempts).toBe(3);
  });

  it("does nothing when hooks is undefined", async () => {
    // should not throw
    await expect(emitRequest(undefined, [], "model", "openai", 1)).resolves.toBeUndefined();
    await expect(emitSuccess(undefined, {})).resolves.toBeUndefined();
    await expect(emitError(undefined, new Error(), 1)).resolves.toBeUndefined();
  });

  it("does nothing when specific hook is not set", async () => {
    const hooks = { onRequest: vi.fn() }; // no onSuccess
    await expect(emitSuccess(hooks, { x: 1 })).resolves.toBeUndefined();
    expect(hooks.onRequest).not.toHaveBeenCalled();
  });

  it("awaits async hooks", async () => {
    const order: number[] = [];
    const onRequest = async () => {
      await new Promise<void>((r) => setTimeout(r, 10));
      order.push(1);
    };
    await emitRequest({ onRequest }, [], "model", "openai", 1);
    order.push(2);
    // hook should complete before we push 2
    expect(order).toEqual([1, 2]);
  });
});
