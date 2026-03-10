import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { classify } from "../../src/classify.js";
import { mockOpenAIClient } from "../fixtures/mock-clients.js";

describe("classify", () => {
  it("classifies into a single label", async () => {
    const client = mockOpenAIClient(JSON.stringify({ label: "positive" }), { toolCall: true });
    const result = await classify({
      client,
      model: "gpt-4o-mini",
      prompt: "I love this product!",
      options: ["positive", "negative", "neutral"],
    });
    expect(result.label).toBe("positive");
    expect(result.labels).toEqual(["positive"]);
  });

  it("returns multiple labels when allowMultiple is true", async () => {
    const client = mockOpenAIClient(
      JSON.stringify({ labels: ["urgent", "billing"] }),
      { toolCall: true }
    );
    const result = await classify({
      client,
      model: "gpt-4o-mini",
      prompt: "My payment failed and my account is suspended!",
      options: ["urgent", "billing", "technical", "general"],
      allowMultiple: true,
    });
    expect(result.labels).toContain("urgent");
    expect(result.labels).toContain("billing");
  });

  it("includes confidence when requested", async () => {
    const client = mockOpenAIClient(
      JSON.stringify({ label: "spam", confidence: 0.95 }),
      { toolCall: true }
    );
    const result = await classify({
      client,
      model: "gpt-4o-mini",
      prompt: "Buy now!! Limited offer!!!",
      options: ["spam", "legitimate"],
      includeConfidence: true,
    });
    expect(result.confidence).toBe(0.95);
  });

  it("includes reasoning when requested", async () => {
    const client = mockOpenAIClient(
      JSON.stringify({ label: "bug", reasoning: "User is reporting a broken feature." }),
      { toolCall: true }
    );
    const result = await classify({
      client,
      model: "gpt-4o-mini",
      prompt: "The export button doesn't work.",
      options: ["bug", "feature-request", "question"],
      includeReasoning: true,
    });
    expect(result.reasoning).toContain("broken");
  });

  it("supports options with descriptions", async () => {
    const client = mockOpenAIClient(JSON.stringify({ label: "tech-support" }), { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;

    await classify({
      client,
      model: "gpt-4o-mini",
      prompt: "My app keeps crashing",
      options: [
        { value: "tech-support", description: "App crashes, errors, bugs" },
        { value: "billing", description: "Payment and subscription issues" },
      ],
    });

    // system prompt should include the option description
    const call = create.mock.calls[0][0];
    const systemMsg = call.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMsg.content).toContain("App crashes, errors, bugs");
  });

  it("sets label to first element of labels array for single-label", async () => {
    const client = mockOpenAIClient(JSON.stringify({ label: "neutral" }), { toolCall: true });
    const result = await classify({
      client,
      model: "gpt-4o-mini",
      prompt: "It is what it is.",
      options: ["positive", "negative", "neutral"],
    });
    expect(result.label).toBe("neutral");
    expect(result.labels).toHaveLength(1);
    expect(result.labels[0]).toBe("neutral");
  });

  it("appends classification system prompt to existing systemPrompt", async () => {
    const client = mockOpenAIClient(JSON.stringify({ label: "positive" }), { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;

    await classify({
      client,
      model: "gpt-4o-mini",
      prompt: "text",
      options: ["positive", "negative"],
      systemPrompt: "You are a product analyst.",
    });

    const call = create.mock.calls[0][0];
    const systemMsg = call.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMsg.content).toContain("You are a product analyst.");
    expect(systemMsg.content).toContain("positive");
  });
});
