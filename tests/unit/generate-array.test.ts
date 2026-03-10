import { describe, it, expect } from "vitest";
import { z } from "zod";
import { generateArray } from "../../src/generate-array.js";
import { mockOpenAIClient } from "../fixtures/mock-clients.js";

const ProductSchema = z.object({
  name: z.string(),
  price: z.number(),
  inStock: z.boolean(),
});

describe("generateArray", () => {
  it("extracts an array of items", async () => {
    const items = [
      { name: "Widget", price: 9.99, inStock: true },
      { name: "Gadget", price: 24.99, inStock: false },
      { name: "Doohickey", price: 4.99, inStock: true },
    ];
    const client = mockOpenAIClient(JSON.stringify({ items }), { toolCall: true });

    const result = await generateArray({
      client,
      model: "gpt-4o-mini",
      schema: ProductSchema,
      prompt: "List all products: Widget $9.99 in stock, Gadget $24.99 out of stock, Doohickey $4.99 in stock",
    });

    expect(result.data).toHaveLength(3);
    expect(result.data[0].name).toBe("Widget");
    expect(result.data[1].price).toBe(24.99);
    expect(result.data[2].inStock).toBe(true);
  });

  it("returns empty array when no items found", async () => {
    const client = mockOpenAIClient(JSON.stringify({ items: [] }), { toolCall: true });

    const result = await generateArray({
      client,
      model: "gpt-4o-mini",
      schema: ProductSchema,
      prompt: "List products from this empty text",
    });

    expect(result.data).toHaveLength(0);
  });

  it("adds minItems/maxItems hints to the prompt", async () => {
    const items = [{ name: "A", price: 1, inStock: true }];
    const client = mockOpenAIClient(JSON.stringify({ items }), { toolCall: true });

    await generateArray({
      client,
      model: "gpt-4o-mini",
      schema: ProductSchema,
      prompt: "List products",
      minItems: 3,
      maxItems: 10,
    });

    // check that the call included hint about min/max
    const callArgs = client.chat.completions.create.mock.calls[0][0];
    const userMsg = callArgs.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg?.content).toContain("3");
    expect(userMsg?.content).toContain("10");
  });

  it("works with simple string arrays", async () => {
    const TagSchema = z.string();
    const client = mockOpenAIClient(
      JSON.stringify({ items: ["typescript", "nodejs", "ai"] }),
      { toolCall: true }
    );

    const result = await generateArray({
      client,
      model: "gpt-4o-mini",
      schema: TagSchema,
      prompt: "Extract tags",
    });

    expect(result.data).toEqual(["typescript", "nodejs", "ai"]);
  });

  it("returns usage info when trackUsage is true", async () => {
    const items = [{ name: "Item", price: 10, inStock: true }];
    const client = mockOpenAIClient(JSON.stringify({ items }), {
      toolCall: true,
      tokens: { prompt: 150, completion: 60 },
    });

    const result = await generateArray({
      client,
      model: "gpt-4o-mini",
      schema: ProductSchema,
      prompt: "List products",
      trackUsage: true,
    });

    expect(result.usage?.totalTokens).toBe(210);
  });
});
