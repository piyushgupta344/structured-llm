import { describe, it, expect, vi } from "vitest";
import { extract } from "../../src/extract.js";
import { mockOpenAIClient } from "../fixtures/mock-clients.js";

describe("extract", () => {
  it("extracts string fields from text", async () => {
    const data = { name: "Alice Smith", email: "alice@example.com" };
    const client = mockOpenAIClient(JSON.stringify(data), { toolCall: true });

    const result = await extract({
      client,
      model: "gpt-4o-mini",
      prompt: "Alice Smith, reach me at alice@example.com",
      fields: { name: "string", email: "email" },
    });

    expect(result.name).toBe("Alice Smith");
    expect(result.email).toBe("alice@example.com");
  });

  it("extracts number and boolean fields", async () => {
    const data = { age: 32, active: true, score: 8.5 };
    const client = mockOpenAIClient(JSON.stringify(data), { toolCall: true });

    const result = await extract({
      client,
      model: "gpt-4o-mini",
      prompt: "User is 32 years old, currently active with score 8.5",
      fields: { age: "integer", active: "boolean", score: "number" },
    });

    expect(result.age).toBe(32);
    expect(result.active).toBe(true);
    expect(result.score).toBe(8.5);
  });

  it("accepts FieldDef objects with description and required", async () => {
    const data = { total: 149.99 };
    const client = mockOpenAIClient(JSON.stringify(data), { toolCall: true });

    const result = await extract({
      client,
      model: "gpt-4o-mini",
      prompt: "Total amount due: $149.99",
      fields: {
        total: { type: "number", description: "Total amount due", required: true },
        discount: { type: "number", description: "Discount applied if any" },
      },
    });

    expect(result.total).toBe(149.99);
  });

  it("generates field descriptions in system prompt from FieldDef", async () => {
    const client = mockOpenAIClient(JSON.stringify({ price: 10 }), { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;

    await extract({
      client,
      model: "gpt-4o-mini",
      prompt: "product price is $10",
      fields: { price: { type: "number", description: "Product price in USD" } },
    });

    const call = create.mock.calls[0][0];
    const systemMsg = call.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMsg.content).toContain("Product price in USD");
  });

  it("uses custom systemPrompt when provided", async () => {
    const client = mockOpenAIClient(JSON.stringify({ name: "Bob" }), { toolCall: true });
    const create = client.chat.completions.create as ReturnType<typeof vi.fn>;

    await extract({
      client,
      model: "gpt-4o-mini",
      prompt: "text",
      fields: { name: "string" },
      systemPrompt: "Custom extraction instructions.",
    });

    const call = create.mock.calls[0][0];
    const systemMsg = call.messages.find((m: { role: string }) => m.role === "system");
    expect(systemMsg.content).toBe("Custom extraction instructions.");
  });

  it("supports enum fields via options array", async () => {
    const data = { status: "active" };
    const client = mockOpenAIClient(JSON.stringify(data), { toolCall: true });

    const result = await extract({
      client,
      model: "gpt-4o-mini",
      prompt: "account is active",
      fields: {
        status: { type: "string", options: ["active", "inactive", "suspended"] },
      },
    });

    expect(result.status).toBe("active");
  });

  it("requireAll marks all fields as required in schema", async () => {
    const data = { name: "Test", email: "test@example.com" };
    const client = mockOpenAIClient(JSON.stringify(data), { toolCall: true });

    const result = await extract({
      client,
      model: "gpt-4o-mini",
      prompt: "Test, test@example.com",
      fields: { name: "string", email: "email" },
      requireAll: true,
    });

    expect(result.name).toBe("Test");
  });
});
