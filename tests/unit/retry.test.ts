import { describe, it, expect } from "vitest";
import { buildRetryMessage, extractJSON, retryDelay } from "../../src/retry.js";

describe("extractJSON", () => {
  it("returns clean JSON as-is", () => {
    const json = '{"name":"Alice","age":30}';
    expect(extractJSON(json)).toBe(json);
  });

  it("strips markdown code fences with json tag", () => {
    const input = '```json\n{"name":"Alice"}\n```';
    expect(extractJSON(input)).toBe('{"name":"Alice"}');
  });

  it("strips plain markdown code fences", () => {
    const input = '```\n{"name":"Alice"}\n```';
    expect(extractJSON(input)).toBe('{"name":"Alice"}');
  });

  it("extracts JSON from surrounding prose", () => {
    const input = 'Sure! Here is the result: {"name":"Alice","age":30} Let me know if you need more.';
    const result = extractJSON(input);
    expect(result).toBe('{"name":"Alice","age":30}');
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("extracts JSON array", () => {
    const input = 'Here are the items: [{"id":1},{"id":2}]';
    const result = extractJSON(input);
    expect(result).toBe('[{"id":1},{"id":2}]');
  });

  it("handles multiline JSON", () => {
    const input = '{\n  "name": "Bob",\n  "score": 0.9\n}';
    const result = extractJSON(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it("prefers code fences over brace extraction", () => {
    const input = 'some { junk } ```json\n{"correct":"value"}\n``` more { junk }';
    const result = extractJSON(input);
    expect(result).toBe('{"correct":"value"}');
  });
});

describe("buildRetryMessage", () => {
  it("includes parse error message for invalid JSON", () => {
    const msg = buildRetryMessage(1, 3, "parse", "", "not json");
    expect(msg).toContain("valid JSON");
  });

  it("includes validation errors for failed schema validation", () => {
    const msg = buildRetryMessage(2, 3, "validation", "- score: must be ≤ 1", '{"score":2}');
    expect(msg).toContain("score");
    expect(msg).toContain("must be ≤ 1");
  });

  it("includes the previous response (truncated)", () => {
    const prev = '{"score": 1.5}';
    const msg = buildRetryMessage(1, 3, "validation", "error", prev);
    expect(msg).toContain(prev);
  });

  it("shows attempt number", () => {
    const msg = buildRetryMessage(2, 3, "parse", "", "bad");
    expect(msg).toContain("Attempt");
  });

  it("handles last attempt (no more retries)", () => {
    const msg = buildRetryMessage(3, 3, "validation", "error", "response");
    // should still be a valid message
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });
});

describe("retryDelay", () => {
  it("immediate strategy returns 0", () => {
    expect(retryDelay(1, { strategy: "immediate" })).toBe(0);
    expect(retryDelay(3, { strategy: "immediate" })).toBe(0);
  });

  it("linear strategy scales with attempt", () => {
    const d1 = retryDelay(1, { strategy: "linear", baseDelayMs: 100 });
    const d2 = retryDelay(2, { strategy: "linear", baseDelayMs: 100 });
    const d3 = retryDelay(3, { strategy: "linear", baseDelayMs: 100 });
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
    expect(d1).toBe(100);
    expect(d2).toBe(200);
  });

  it("exponential strategy grows exponentially", () => {
    const d1 = retryDelay(1, { strategy: "exponential", baseDelayMs: 100 });
    const d2 = retryDelay(2, { strategy: "exponential", baseDelayMs: 100 });
    const d3 = retryDelay(3, { strategy: "exponential", baseDelayMs: 100 });
    expect(d1).toBe(100);
    expect(d2).toBe(200);
    expect(d3).toBe(400);
  });

  it("defaults to immediate (0) with no options", () => {
    expect(retryDelay(1)).toBe(0);
    expect(retryDelay(5)).toBe(0);
  });
});
