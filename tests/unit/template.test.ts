import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createTemplate } from "../../src/template.js";
import { mockOpenAIClient } from "../fixtures/mock-clients.js";

const SimpleSchema = z.object({ result: z.string() });

describe("createTemplate", () => {
  it("renders template with variables", () => {
    const client = mockOpenAIClient("{}", { toolCall: true });
    const tmpl = createTemplate({
      template: "Analyze {{docType}} from {{company}}",
      schema: SimpleSchema,
      client,
      model: "gpt-4o-mini",
    });

    const rendered = tmpl.render({ docType: "invoice", company: "Acme" });
    expect(rendered).toBe("Analyze invoice from Acme");
  });

  it("renders number variables", () => {
    const client = mockOpenAIClient("{}", { toolCall: true });
    const tmpl = createTemplate({
      template: "Top {{count}} results for {{query}}",
      schema: SimpleSchema,
      client,
      model: "gpt-4o-mini",
    });

    const rendered = tmpl.render({ count: 10, query: "typescript" });
    expect(rendered).toBe("Top 10 results for typescript");
  });

  it("throws if a template variable is missing", () => {
    const client = mockOpenAIClient("{}", { toolCall: true });
    const tmpl = createTemplate({
      template: "Hello {{name}}, your code is {{code}}",
      schema: SimpleSchema,
      client,
      model: "gpt-4o-mini",
    });

    expect(() => tmpl.render({ name: "Alice" })).toThrow('Template variable "{{code}}" not provided');
  });

  it("run() sends rendered template as prompt", async () => {
    const response = JSON.stringify({ result: "ok" });
    const client = mockOpenAIClient(response, { toolCall: true });

    const tmpl = createTemplate({
      template: "Classify: {{text}}",
      schema: SimpleSchema,
      client,
      model: "gpt-4o-mini",
    });

    const { data } = await tmpl.run({ text: "hello world" });
    expect(data.result).toBe("ok");
  });

  it("run() merges overrides into generate call", async () => {
    const response = JSON.stringify({ result: "overridden" });
    const client = mockOpenAIClient(response, { toolCall: true });

    const tmpl = createTemplate({
      template: "Say {{thing}}",
      schema: SimpleSchema,
      client,
      model: "gpt-4o-mini",
      temperature: 0.7,
    });

    // Override temperature
    const { data } = await tmpl.run({ thing: "hello" }, { temperature: 0 });
    expect(data.result).toBe("overridden");
  });

  it("runArray() wraps schema in array and calls generateArray", async () => {
    const response = JSON.stringify({ items: [{ result: "a" }, { result: "b" }] });
    const client = mockOpenAIClient(response, { toolCall: true });

    const tmpl = createTemplate({
      template: "List {{count}} things about {{topic}}",
      schema: SimpleSchema,
      client,
      model: "gpt-4o-mini",
    });

    const { data } = await tmpl.runArray({ count: 2, topic: "AI" });
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(2);
  });
});
