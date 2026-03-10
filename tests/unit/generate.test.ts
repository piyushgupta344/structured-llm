import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { generate } from "../../src/generate.js";
import {
  ValidationError,
  ParseError,
  MissingInputError,
} from "../../src/errors.js";
import {
  mockOpenAIClient,
  mockAnthropicClient,
  mockFlakyClient,
  mockGeminiClient,
  mockMistralClient,
} from "../fixtures/mock-clients.js";

// ── helpers ────────────────────────────────────────────────────────────────────

const SentimentSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(0).max(1),
  summary: z.string(),
});

const UserSchema = z.object({
  name: z.string(),
  age: z.number().int().min(0),
  email: z.string().email(),
});

const validSentiment = JSON.stringify({
  sentiment: "positive",
  score: 0.9,
  summary: "Great product overall",
});

const validUser = JSON.stringify({
  name: "Alice Smith",
  age: 28,
  email: "alice@example.com",
});

// ── basic extraction ───────────────────────────────────────────────────────────

describe("generate — basic extraction", () => {
  it("extracts structured data from OpenAI (tool calling)", async () => {
    const client = mockOpenAIClient(validSentiment, { toolCall: true });
    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze: Great product!",
    });

    expect(result.data.sentiment).toBe("positive");
    expect(result.data.score).toBe(0.9);
    expect(result.data.summary).toBe("Great product overall");
  });

  it("extracts structured data from OpenAI (json mode)", async () => {
    const client = mockOpenAIClient(validUser);
    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: UserSchema,
      prompt: "Extract: Alice Smith, 28, alice@example.com",
      mode: "json-mode",
    });

    expect(result.data.name).toBe("Alice Smith");
    expect(result.data.age).toBe(28);
    expect(result.data.email).toBe("alice@example.com");
  });

  it("works with Anthropic client", async () => {
    const client = mockAnthropicClient(validSentiment, { toolUse: true });
    const result = await generate({
      client,
      model: "claude-sonnet-4-6",
      schema: SentimentSchema,
      prompt: "Analyze: Great product!",
    });

    expect(result.data.sentiment).toBe("positive");
  });

  it("works with Gemini client", async () => {
    const client = mockGeminiClient(validSentiment, { functionCall: true });
    const result = await generate({
      client,
      model: "gemini-2.0-flash",
      schema: SentimentSchema,
      prompt: "Analyze: Great product!",
    });

    expect(result.data.sentiment).toBe("positive");
  });

  it("works with Mistral client", async () => {
    const client = mockMistralClient(validSentiment, { toolCall: true });
    const result = await generate({
      client,
      model: "mistral-large-latest",
      schema: SentimentSchema,
      prompt: "Analyze: Great product!",
    });

    expect(result.data.sentiment).toBe("positive");
  });

  it("accepts messages array instead of prompt", async () => {
    const client = mockOpenAIClient(validSentiment, { toolCall: true });
    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      messages: [
        { role: "system", content: "You are a sentiment analyzer." },
        { role: "user", content: "Analyze: Great product!" },
      ],
    });

    expect(result.data).toBeDefined();
  });

  it("handles JSON wrapped in markdown code fences", async () => {
    const wrapped = "```json\n" + validSentiment + "\n```";
    const client = mockOpenAIClient(wrapped);
    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze something",
      mode: "json-mode",
    });

    expect(result.data.sentiment).toBe("positive");
  });

  it("handles JSON with surrounding prose", async () => {
    const withProse = `Here is your analysis: ${validSentiment} Hope that helps!`;
    const client = mockOpenAIClient(withProse);
    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze",
      mode: "prompt-inject",
    });

    expect(result.data.sentiment).toBe("positive");
  });
});

// ── error handling ─────────────────────────────────────────────────────────────

describe("generate — error handling", () => {
  it("throws MissingInputError when no prompt or messages", async () => {
    const client = mockOpenAIClient(validSentiment);
    await expect(
      generate({ client, model: "gpt-4o-mini", schema: SentimentSchema })
    ).rejects.toThrow(MissingInputError);
  });

  it("throws ParseError after max retries with invalid JSON", async () => {
    const client = mockOpenAIClient("this is definitely not json at all");
    await expect(
      generate({
        client,
        model: "gpt-4o-mini",
        schema: SentimentSchema,
        prompt: "Analyze",
        maxRetries: 0,
      })
    ).rejects.toThrow(ParseError);
  });

  it("throws ValidationError after max retries with invalid schema", async () => {
    const badData = JSON.stringify({ sentiment: "mixed", score: 999, summary: "ok" });
    const client = mockOpenAIClient(badData);
    await expect(
      generate({
        client,
        model: "gpt-4o-mini",
        schema: SentimentSchema,
        prompt: "Analyze",
        maxRetries: 0,
      })
    ).rejects.toThrow(ValidationError);
  });
});

// ── retry logic ────────────────────────────────────────────────────────────────

describe("generate — retry", () => {
  it("retries on invalid JSON and succeeds", async () => {
    const client = mockFlakyClient(1, validSentiment);
    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze",
      maxRetries: 3,
    });

    expect(result.data.sentiment).toBe("positive");
    expect(client.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it("retries twice and still succeeds", async () => {
    const client = mockFlakyClient(2, validSentiment);
    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze",
      maxRetries: 3,
    });

    expect(result.data.sentiment).toBe("positive");
    expect(client.chat.completions.create).toHaveBeenCalledTimes(3);
  });

  it("fails after exhausting retries", async () => {
    const client = mockFlakyClient(10, validSentiment); // always fails
    await expect(
      generate({
        client,
        model: "gpt-4o-mini",
        schema: SentimentSchema,
        prompt: "Analyze",
        maxRetries: 2,
      })
    ).rejects.toThrow();
  });
});

// ── hooks ──────────────────────────────────────────────────────────────────────

describe("generate — hooks", () => {
  it("calls onRequest hook", async () => {
    const onRequest = vi.fn();
    const client = mockOpenAIClient(validSentiment, { toolCall: true });

    await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze",
      hooks: { onRequest },
    });

    expect(onRequest).toHaveBeenCalledOnce();
    expect(onRequest.mock.calls[0][0]).toMatchObject({
      model: "gpt-4o-mini",
      attempt: 1,
    });
  });

  it("calls onSuccess hook with result", async () => {
    const onSuccess = vi.fn();
    const client = mockOpenAIClient(validSentiment, { toolCall: true });

    await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze",
      hooks: { onSuccess },
    });

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onSuccess.mock.calls[0][0].result.sentiment).toBe("positive");
  });

  it("calls onRetry hook when retrying", async () => {
    const onRetry = vi.fn();
    const client = mockFlakyClient(1, validSentiment);

    await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze",
      maxRetries: 3,
      hooks: { onRetry },
    });

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("calls onError hook on failure", async () => {
    const onError = vi.fn();
    const client = mockOpenAIClient("not json");

    await expect(
      generate({
        client,
        model: "gpt-4o-mini",
        schema: SentimentSchema,
        prompt: "Analyze",
        maxRetries: 0,
        hooks: { onError },
      })
    ).rejects.toThrow();

    expect(onError).toHaveBeenCalledOnce();
  });
});

// ── usage tracking ─────────────────────────────────────────────────────────────

describe("generate — usage tracking", () => {
  it("returns usage info when trackUsage is true", async () => {
    const client = mockOpenAIClient(validSentiment, {
      toolCall: true,
      tokens: { prompt: 200, completion: 80 },
    });

    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze",
      trackUsage: true,
    });

    expect(result.usage).toBeDefined();
    expect(result.usage?.promptTokens).toBe(200);
    expect(result.usage?.completionTokens).toBe(80);
    expect(result.usage?.totalTokens).toBe(280);
    expect(result.usage?.model).toBe("gpt-4o-mini");
    expect(result.usage?.provider).toBe("openai");
    expect(result.usage?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.usage?.estimatedCostUsd).toBeDefined();
  });

  it("does not include usage when trackUsage is false (default)", async () => {
    const client = mockOpenAIClient(validSentiment, { toolCall: true });
    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze",
    });

    expect(result.usage).toBeUndefined();
  });
});

// ── complex schemas ────────────────────────────────────────────────────────────

describe("generate — complex schemas", () => {
  it("handles nested objects", async () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        address: z.object({ city: z.string(), country: z.string() }),
      }),
    });
    const data = {
      user: { name: "Bob", address: { city: "Paris", country: "France" } },
    };
    const client = mockOpenAIClient(JSON.stringify(data), { toolCall: true });

    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema,
      prompt: "Extract user info",
    });

    expect(result.data.user.address.city).toBe("Paris");
  });

  it("handles arrays in schema", async () => {
    const schema = z.object({
      tags: z.array(z.string()),
      scores: z.array(z.number()),
    });
    const data = { tags: ["ai", "typescript"], scores: [0.9, 0.7] };
    const client = mockOpenAIClient(JSON.stringify(data), { toolCall: true });

    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema,
      prompt: "Extract",
    });

    expect(result.data.tags).toEqual(["ai", "typescript"]);
    expect(result.data.scores).toEqual([0.9, 0.7]);
  });

  it("handles optional fields", async () => {
    const schema = z.object({
      name: z.string(),
      bio: z.string().optional(),
    });
    const data = { name: "Alice" }; // no bio
    const client = mockOpenAIClient(JSON.stringify(data), { toolCall: true });

    const result = await generate({
      client,
      model: "gpt-4o-mini",
      schema,
      prompt: "Extract",
    });

    expect(result.data.name).toBe("Alice");
    expect(result.data.bio).toBeUndefined();
  });
});

// ── system prompt ──────────────────────────────────────────────────────────────

describe("generate — systemPrompt", () => {
  it("passes system prompt to the LLM", async () => {
    const client = mockOpenAIClient(validSentiment, { toolCall: true });
    await generate({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: "Analyze this",
      systemPrompt: "You are an expert sentiment analyzer.",
    });

    const callArgs = client.chat.completions.create.mock.calls[0][0];
    const systemMsg = callArgs.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMsg?.content).toContain("expert sentiment analyzer");
  });
});
