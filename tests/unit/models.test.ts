import { describe, it, expect } from "vitest";
import { getModelCapabilities, listSupportedModels, resolveMode } from "../../src/models.js";

describe("getModelCapabilities", () => {
  it("returns capabilities for known OpenAI models", () => {
    const caps = getModelCapabilities("gpt-4o-mini");
    expect(caps).toBeDefined();
    expect(caps?.provider).toBe("openai");
    expect(caps?.toolCalling).toBe(true);
    expect(caps?.jsonMode).toBe(true);
    expect(caps?.streaming).toBe(true);
    expect(caps?.contextWindow).toBeGreaterThan(0);
  });

  it("returns capabilities for Anthropic models", () => {
    const caps = getModelCapabilities("claude-sonnet-4-6");
    expect(caps?.provider).toBe("anthropic");
    expect(caps?.toolCalling).toBe(true);
    expect(caps?.jsonMode).toBe(false); // anthropic doesn't have native json mode
  });

  it("returns capabilities for Gemini models", () => {
    const caps = getModelCapabilities("gemini-2.0-flash");
    expect(caps?.provider).toBe("gemini");
    expect(caps?.jsonMode).toBe(true);
  });

  it("returns capabilities for Groq models", () => {
    const caps = getModelCapabilities("llama-3.3-70b-versatile");
    expect(caps?.provider).toBe("groq");
  });

  it("returns undefined for unknown models", () => {
    expect(getModelCapabilities("totally-made-up-model-v99")).toBeUndefined();
  });

  it("includes cost information for paid models", () => {
    const caps = getModelCapabilities("gpt-4o");
    expect(caps?.inputCostPer1M).toBeGreaterThan(0);
    expect(caps?.outputCostPer1M).toBeGreaterThan(0);
  });

  it("has zero cost for Ollama (local) models", () => {
    const caps = getModelCapabilities("llama3.2");
    expect(caps?.inputCostPer1M).toBe(0);
    expect(caps?.outputCostPer1M).toBe(0);
  });

  it("marks OpenAI strict-schema-compatible models with strictJsonSchema: true", () => {
    expect(getModelCapabilities("gpt-4.1")?.strictJsonSchema).toBe(true);
    expect(getModelCapabilities("gpt-4o")?.strictJsonSchema).toBe(true);
    expect(getModelCapabilities("gpt-4o-mini")?.strictJsonSchema).toBe(true);
    expect(getModelCapabilities("o3")?.strictJsonSchema).toBe(true);
    expect(getModelCapabilities("o4-mini")?.strictJsonSchema).toBe(true);
  });

  it("marks non-strict models with strictJsonSchema: false", () => {
    expect(getModelCapabilities("gpt-4-turbo")?.strictJsonSchema).toBe(false);
    expect(getModelCapabilities("claude-sonnet-4-6")?.strictJsonSchema).toBe(false);
    expect(getModelCapabilities("gemini-2.5-pro")?.strictJsonSchema).toBe(false);
  });
});

describe("listSupportedModels", () => {
  it("returns all models when no filter given", () => {
    const models = listSupportedModels();
    expect(models.length).toBeGreaterThan(10);
  });

  it("filters by provider", () => {
    const openaiModels = listSupportedModels({ provider: "openai" });
    expect(openaiModels.every((m) => getModelCapabilities(m)?.provider === "openai")).toBe(true);
    expect(openaiModels.length).toBeGreaterThan(0);
  });

  it("returns empty array for provider with no registered models", () => {
    // bedrock doesn't have models in registry yet
    const bedrockModels = listSupportedModels({ provider: "bedrock" });
    expect(Array.isArray(bedrockModels)).toBe(true);
  });
});

describe("resolveMode", () => {
  it("returns json-schema for OpenAI models that support strict JSON schema", () => {
    expect(resolveMode("gpt-4o-mini")).toBe("json-schema");
    expect(resolveMode("gpt-4o")).toBe("json-schema");
    expect(resolveMode("gpt-4.1")).toBe("json-schema");
  });

  it("returns tool-calling for models that support it but not strict JSON schema", () => {
    expect(resolveMode("claude-sonnet-4-6")).toBe("tool-calling");
    expect(resolveMode("gpt-4-turbo")).toBe("tool-calling");
  });

  it("returns json-mode when tool-calling not supported but json-mode is", () => {
    expect(resolveMode("gemma2-9b-it")).toBe("json-mode");
  });

  it("respects explicit mode override", () => {
    expect(resolveMode("gpt-4o-mini", "json-mode")).toBe("json-mode");
    expect(resolveMode("gpt-4o-mini", "prompt-inject")).toBe("prompt-inject");
    expect(resolveMode("gpt-4o-mini", "tool-calling")).toBe("tool-calling");
  });

  it("defaults to tool-calling for unknown models", () => {
    expect(resolveMode("some-unknown-model-123")).toBe("tool-calling");
  });

  it("auto mode resolves to json-schema for models that support strict JSON schema", () => {
    expect(resolveMode("gpt-4o", "auto")).toBe("json-schema");
    expect(resolveMode("o4-mini", "auto")).toBe("json-schema");
  });
});
