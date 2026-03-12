import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { generateBatch } from "../../src/generate-batch.js";
import { mockOpenAIClient } from "../fixtures/mock-clients.js";

const SentimentSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
});

describe("generateBatch", () => {
  it("processes all inputs and returns results in order", async () => {
    const responses = [
      JSON.stringify({ sentiment: "positive" }),
      JSON.stringify({ sentiment: "negative" }),
      JSON.stringify({ sentiment: "neutral" }),
    ];
    let callCount = 0;
    const client = {
      constructor: { name: "OpenAI" },
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async (params: { tool_choice?: unknown }) => {
            const resp = responses[callCount++] ?? responses[0];
            if (params.tool_choice) {
              return {
                choices: [{ message: { tool_calls: [{ function: { arguments: resp } }] } }],
                usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
              };
            }
            return {
              choices: [{ message: { content: resp } }],
              usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
            };
          }),
        },
      },
      models: { list: vi.fn() },
    };

    const result = await generateBatch({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      inputs: [
        { prompt: "Great product!" },
        { prompt: "Terrible experience." },
        { prompt: "It was okay." },
      ],
      concurrency: 2,
    });

    expect(result.items).toHaveLength(3);
    expect(result.succeeded).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(result.items[0].data?.sentiment).toBe("positive");
    expect(result.items[1].data?.sentiment).toBe("negative");
    expect(result.items[2].data?.sentiment).toBe("neutral");
  });

  it("continues on error by default (continueOnError=true)", async () => {
    let callCount = 0;
    const client = {
      constructor: { name: "OpenAI" },
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async (params: { tool_choice?: unknown }) => {
            callCount++;
            if (callCount === 2) throw new Error("API error");
            if (params.tool_choice) {
              return {
                choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ sentiment: "positive" }) } }] } }],
                usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
              };
            }
            return {
              choices: [{ message: { content: JSON.stringify({ sentiment: "positive" }) } }],
              usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
            };
          }),
        },
      },
      models: { list: vi.fn() },
    };

    const result = await generateBatch({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      inputs: [{ prompt: "first" }, { prompt: "second" }, { prompt: "third" }],
      continueOnError: true,
    });

    expect(result.succeeded).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].index).toBe(1);
    expect(result.failed[0].error?.message).toContain("API error");
  });

  it("throws immediately when continueOnError=false", async () => {
    const client = {
      constructor: { name: "OpenAI" },
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("hard fail")),
        },
      },
      models: { list: vi.fn() },
    };

    await expect(
      generateBatch({
        client,
        model: "gpt-4o-mini",
        schema: SentimentSchema,
        inputs: [{ prompt: "test" }],
        continueOnError: false,
      })
    ).rejects.toThrow("hard fail");
  });

  it("calls onProgress callback correctly", async () => {
    const client = mockOpenAIClient(JSON.stringify({ sentiment: "positive" }), { toolCall: true });
    const progress: number[] = [];

    await generateBatch({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      inputs: [{ prompt: "a" }, { prompt: "b" }, { prompt: "c" }],
      concurrency: 1,
      onProgress: ({ completed }) => progress.push(completed),
    });

    expect(progress).toEqual([1, 2, 3]);
  });

  it("aggregates usage across all items", async () => {
    const client = mockOpenAIClient(
      JSON.stringify({ sentiment: "positive" }),
      { toolCall: true, tokens: { prompt: 100, completion: 50 } }
    );

    const result = await generateBatch({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      inputs: [{ prompt: "a" }, { prompt: "b" }],
      trackUsage: true,
    });

    expect(result.totalUsage).toBeDefined();
    expect(result.totalUsage!.promptTokens).toBe(200);
    expect(result.totalUsage!.completionTokens).toBe(100);
    expect(result.totalUsage!.totalTokens).toBe(300);
  });

  it("records durationMs for each item", async () => {
    const client = mockOpenAIClient(JSON.stringify({ sentiment: "positive" }), { toolCall: true });

    const result = await generateBatch({
      client,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      inputs: [{ prompt: "test" }],
    });

    expect(result.items[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});
