import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { generateMultiSchema } from "../../src/generate-multi-schema.js";

const TitleSchema = z.object({ title: z.string() });
const SentimentSchema = z.object({ sentiment: z.enum(["positive", "negative", "neutral"]) });

function makeClient(responses: string[]) {
  let callIdx = 0;
  return {
    constructor: { name: "OpenAI" },
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async (params: { tool_choice?: unknown }) => {
          const resp = responses[callIdx++ % responses.length];
          if (params.tool_choice) {
            return {
              choices: [{ message: { tool_calls: [{ function: { arguments: resp } }] } }],
              usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
            };
          }
          return {
            choices: [{ message: { content: resp } }],
            usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
          };
        }),
      },
    },
    models: { list: vi.fn() },
  };
}

describe("generateMultiSchema", () => {
  it("runs multiple schemas against the same prompt", async () => {
    const client = makeClient([
      JSON.stringify({ title: "AI in Healthcare" }),
      JSON.stringify({ sentiment: "positive" }),
    ]);

    const { results } = await generateMultiSchema({
      client,
      model: "gpt-4o-mini",
      prompt: "AI is revolutionizing healthcare in amazing ways.",
      schemas: { meta: TitleSchema, sentiment: SentimentSchema },
    });

    expect(results.meta.data?.title).toBe("AI in Healthcare");
    expect(results.sentiment.data?.sentiment).toBe("positive");
    expect(results.meta.error).toBeUndefined();
    expect(results.sentiment.error).toBeUndefined();
  });

  it("runs schemas in parallel by default (parallel=true)", async () => {
    const order: string[] = [];
    const client = {
      constructor: { name: "OpenAI" },
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async (params: { tool_choice?: unknown; messages: Array<{role: string; content: string}> }) => {
            const prompt = params.messages.find(m => m.role === "user")?.content ?? "";
            order.push(prompt);
            return {
              choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ title: "x", sentiment: "positive" }) } }] } }],
              usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
            };
          }),
        },
      },
      models: { list: vi.fn() },
    };

    await generateMultiSchema({
      client,
      model: "gpt-4o-mini",
      prompt: "test prompt",
      schemas: { a: TitleSchema, b: SentimentSchema },
      parallel: true,
    });

    expect(order).toHaveLength(2);
  });

  it("continues on individual schema errors with continueOnError=true", async () => {
    let callCount = 0;
    const client = {
      constructor: { name: "OpenAI" },
      chat: {
        completions: {
          create: vi.fn().mockImplementation(async () => {
            callCount++;
            if (callCount === 1) throw new Error("schema error");
            return {
              choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ sentiment: "neutral" }) } }] } }],
              usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
            };
          }),
        },
      },
      models: { list: vi.fn() },
    };

    const { results } = await generateMultiSchema({
      client,
      model: "gpt-4o-mini",
      prompt: "test",
      schemas: { meta: TitleSchema, sentiment: SentimentSchema },
      continueOnError: true,
    });

    // One should have errored, one should have succeeded
    const errored = [results.meta, results.sentiment].filter((r) => r.error);
    const succeeded = [results.meta, results.sentiment].filter((r) => r.data);
    expect(errored).toHaveLength(1);
    expect(succeeded).toHaveLength(1);
  });

  it("aggregates usage from all schemas", async () => {
    const client = makeClient([
      JSON.stringify({ title: "T" }),
      JSON.stringify({ sentiment: "positive" }),
    ]);

    const { totalUsage } = await generateMultiSchema({
      client,
      model: "gpt-4o-mini",
      prompt: "test",
      schemas: { a: TitleSchema, b: SentimentSchema },
      trackUsage: true,
    });

    expect(totalUsage).toBeDefined();
    expect(totalUsage!.totalTokens).toBe(150); // 75 * 2
  });

  it("includes durationMs for each schema", async () => {
    const client = makeClient([
      JSON.stringify({ title: "T" }),
      JSON.stringify({ sentiment: "positive" }),
    ]);

    const { results } = await generateMultiSchema({
      client,
      model: "gpt-4o-mini",
      prompt: "test",
      schemas: { a: TitleSchema, b: SentimentSchema },
    });

    expect(results.a.durationMs).toBeGreaterThanOrEqual(0);
    expect(results.b.durationMs).toBeGreaterThanOrEqual(0);
  });
});
