import { describe, it, expect } from "vitest";
import { buildUsage, calcCost, estimateTokens } from "../../src/usage.js";

describe("calcCost", () => {
  it("calculates cost for known model", () => {
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output
    const cost = calcCost("gpt-4o-mini", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.75, 5);
  });

  it("handles small token counts", () => {
    const cost = calcCost("gpt-4o-mini", 1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01);
  });

  it("returns 0 for unknown model", () => {
    expect(calcCost("totally-unknown-model", 1000, 500)).toBe(0);
  });

  it("returns 0 for Ollama models (free)", () => {
    expect(calcCost("llama3.2", 100000, 50000)).toBe(0);
  });

  it("gpt-4 is more expensive than gpt-4o-mini", () => {
    const cheapCost = calcCost("gpt-4o-mini", 10000, 5000);
    const expensiveCost = calcCost("gpt-4", 10000, 5000);
    expect(expensiveCost).toBeGreaterThan(cheapCost);
  });
});

describe("buildUsage", () => {
  it("builds a complete UsageInfo object", () => {
    const start = Date.now() - 1000;
    const usage = buildUsage("gpt-4o-mini", "openai", 100, 50, start, 2);

    expect(usage.promptTokens).toBe(100);
    expect(usage.completionTokens).toBe(50);
    expect(usage.totalTokens).toBe(150);
    expect(usage.model).toBe("gpt-4o-mini");
    expect(usage.provider).toBe("openai");
    expect(usage.attempts).toBe(2);
    expect(usage.latencyMs).toBeGreaterThan(900);
    expect(usage.estimatedCostUsd).toBeDefined();
    expect(usage.estimatedCostUsd!).toBeGreaterThanOrEqual(0);
  });

  it("latency is reasonable", () => {
    const start = Date.now();
    const usage = buildUsage("gpt-4o", "openai", 0, 0, start, 1);
    expect(usage.latencyMs).toBeGreaterThanOrEqual(0);
    expect(usage.latencyMs).toBeLessThan(100); // should be near-instant
  });
});

describe("estimateTokens", () => {
  it("estimates roughly 1 token per 4 chars", () => {
    // 40 chars → ~10 tokens
    expect(estimateTokens("a".repeat(40))).toBe(10);
  });

  it("rounds up", () => {
    expect(estimateTokens("abc")).toBe(1); // 3 chars → ceil(3/4) = 1
    expect(estimateTokens("abcde")).toBe(2); // 5 chars → ceil(5/4) = 2
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
});
