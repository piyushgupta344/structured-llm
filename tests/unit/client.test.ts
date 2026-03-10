import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createClient } from "../../src/client.js";
import { mockOpenAIClient } from "../fixtures/mock-clients.js";

const Schema = z.object({
  answer: z.string(),
  confidence: z.number(),
});

const validResponse = JSON.stringify({ answer: "yes", confidence: 0.95 });

describe("createClient", () => {
  it("creates a client and calls generate", async () => {
    const openaiClient = mockOpenAIClient(validResponse, { toolCall: true });
    const llm = createClient({
      client: openaiClient,
      model: "gpt-4o-mini",
    });

    const result = await llm.generate({
      schema: Schema,
      prompt: "Is this a good idea?",
    });

    expect(result.data.answer).toBe("yes");
    expect(result.data.confidence).toBe(0.95);
  });

  it("uses defaultOptions.temperature", async () => {
    const openaiClient = mockOpenAIClient(validResponse, { toolCall: true });
    const llm = createClient({
      client: openaiClient,
      model: "gpt-4o-mini",
      defaultOptions: { temperature: 0.7 },
    });

    await llm.generate({ schema: Schema, prompt: "test" });

    const callArgs = openaiClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs.temperature).toBe(0.7);
  });

  it("per-call options override defaultOptions", async () => {
    const openaiClient = mockOpenAIClient(validResponse, { toolCall: true });
    const llm = createClient({
      client: openaiClient,
      model: "gpt-4o-mini",
      defaultOptions: { temperature: 0.7 },
    });

    await llm.generate({ schema: Schema, prompt: "test", temperature: 0 });

    const callArgs = openaiClient.chat.completions.create.mock.calls[0][0];
    expect(callArgs.temperature).toBe(0);
  });

  it("merges global and per-call hooks", async () => {
    const globalHook = vi.fn();
    const localHook = vi.fn();
    const openaiClient = mockOpenAIClient(validResponse, { toolCall: true });

    const llm = createClient({
      client: openaiClient,
      model: "gpt-4o-mini",
      defaultOptions: { hooks: { onSuccess: globalHook } },
    });

    await llm.generate({
      schema: Schema,
      prompt: "test",
      hooks: { onSuccess: localHook },
    });

    expect(globalHook).toHaveBeenCalledOnce();
    expect(localHook).toHaveBeenCalledOnce();
  });

  it("uses defaultModel when model not specified per-call", async () => {
    const openaiClient = mockOpenAIClient(validResponse, { toolCall: true });
    const llm = createClient({
      client: openaiClient,
      model: "gpt-4o-mini",
    });

    // should not throw — model comes from createClient config
    const result = await llm.generate({ schema: Schema, prompt: "test" });
    expect(result.data).toBeDefined();
  });

  it("supports generateArray through the client", async () => {
    const items = [
      { answer: "yes", confidence: 0.9 },
      { answer: "no", confidence: 0.7 },
    ];
    const openaiClient = mockOpenAIClient(JSON.stringify({ items }), { toolCall: true });
    const llm = createClient({ client: openaiClient, model: "gpt-4o-mini" });

    const result = await llm.generateArray({ schema: Schema, prompt: "Extract all answers" });
    expect(result.data).toHaveLength(2);
  });
});
