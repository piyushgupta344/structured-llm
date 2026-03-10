import { describe, it, expect } from "vitest";
import { adapterFromClient } from "../../../src/providers/registry.js";
import {
  mockOpenAIClient,
  mockAnthropicClient,
  mockGeminiClient,
  mockMistralClient,
} from "../../fixtures/mock-clients.js";

describe("adapterFromClient", () => {
  it("detects OpenAI client", () => {
    const client = mockOpenAIClient("{}");
    const adapter = adapterFromClient(client);
    expect(adapter.name).toBe("openai");
  });

  it("detects Anthropic client", () => {
    const client = mockAnthropicClient("{}");
    const adapter = adapterFromClient(client);
    expect(adapter.name).toBe("anthropic");
  });

  it("detects Gemini client", () => {
    const client = mockGeminiClient("{}");
    const adapter = adapterFromClient(client);
    expect(adapter.name).toBe("gemini");
  });

  it("detects Mistral client", () => {
    const client = mockMistralClient("{}");
    const adapter = adapterFromClient(client);
    expect(adapter.name).toBe("mistral");
  });

  it("detects Groq as OpenAI-compat via baseURL", () => {
    const client = {
      constructor: { name: "OpenAI" },
      baseURL: "https://api.groq.com/openai/v1",
      chat: { completions: { create: vi.fn() } },
      models: { list: vi.fn() },
    };
    const adapter = adapterFromClient(client);
    expect(adapter.name).toBe("groq");
  });

  it("detects xAI as OpenAI-compat via baseURL", () => {
    const client = {
      constructor: { name: "OpenAI" },
      baseURL: "https://api.x.ai/v1",
      chat: { completions: { create: vi.fn() } },
      models: { list: vi.fn() },
    };
    const adapter = adapterFromClient(client);
    expect(adapter.name).toBe("xai");
  });

  it("detects Ollama as OpenAI-compat via localhost", () => {
    const client = {
      constructor: { name: "OpenAI" },
      baseURL: "http://localhost:11434/v1",
      chat: { completions: { create: vi.fn() } },
      models: { list: vi.fn() },
    };
    const adapter = adapterFromClient(client);
    expect(adapter.name).toBe("ollama");
  });

  it("throws for completely unknown client", () => {
    expect(() => adapterFromClient({ foo: "bar" })).toThrow();
  });
});
