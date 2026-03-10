import { describe, it, expect } from "vitest";
import {
  ValidationError,
  ParseError,
  ProviderError,
  MaxRetriesError,
  SchemaError,
  UnsupportedProviderError,
  MissingInputError,
} from "../../src/errors.js";

describe("ValidationError", () => {
  it("has correct name and properties", () => {
    const err = new ValidationError(["field: required"], '{"bad":"data"}', 3);
    expect(err.name).toBe("ValidationError");
    expect(err.issues).toEqual(["field: required"]);
    expect(err.lastResponse).toBe('{"bad":"data"}');
    expect(err.attempts).toBe(3);
    expect(err.message).toContain("3 attempt");
  });

  it("is an instanceof Error", () => {
    const err = new ValidationError([], "", 1);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("ParseError", () => {
  it("has correct name and properties", () => {
    const err = new ParseError("not json", 2);
    expect(err.name).toBe("ParseError");
    expect(err.lastResponse).toBe("not json");
    expect(err.attempts).toBe(2);
    expect(err.message).toContain("2 attempt");
  });

  it("truncates long responses in message", () => {
    const longResponse = "x".repeat(500);
    const err = new ParseError(longResponse, 1);
    // message should not be excessively long
    expect(err.message.length).toBeLessThan(400);
  });
});

describe("ProviderError", () => {
  it("includes provider name in message", () => {
    const err = new ProviderError("openai", "rate limit exceeded", 429);
    expect(err.name).toBe("ProviderError");
    expect(err.message).toContain("openai");
    expect(err.provider).toBe("openai");
    expect(err.statusCode).toBe(429);
  });

  it("stores the original error", () => {
    const original = new Error("original");
    const err = new ProviderError("anthropic", "something failed", undefined, original);
    expect(err.originalError).toBe(original);
  });
});

describe("MaxRetriesError", () => {
  it("shows attempts count", () => {
    const err = new MaxRetriesError(3, "last error detail");
    expect(err.message).toContain("3");
    expect(err.lastError).toBe("last error detail");
  });
});

describe("SchemaError", () => {
  it("prefixes message with Invalid schema", () => {
    const err = new SchemaError("must be a Zod schema");
    expect(err.message).toContain("Invalid schema");
    expect(err.message).toContain("must be a Zod schema");
  });
});

describe("UnsupportedProviderError", () => {
  it("mentions the unsupported provider", () => {
    const err = new UnsupportedProviderError("fake-llm");
    expect(err.message).toContain("fake-llm");
  });
});

describe("MissingInputError", () => {
  it("has a helpful message", () => {
    const err = new MissingInputError();
    expect(err.message).toContain("prompt");
  });
});
