import { describe, it, expect } from "vitest";
import { z } from "zod";
import { createZodAdapter, isZodSchema } from "../../../src/schema/adapters/zod.js";

describe("createZodAdapter", () => {
  describe("parse", () => {
    it("parses a valid object", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const adapter = createZodAdapter(schema);
      const result = adapter.parse({ name: "Alice", age: 30 });
      expect(result).toEqual({ name: "Alice", age: 30 });
    });

    it("throws on invalid input", () => {
      const schema = z.object({ name: z.string() });
      const adapter = createZodAdapter(schema);
      expect(() => adapter.parse({ name: 123 })).toThrow();
    });
  });

  describe("safeParse", () => {
    it("returns success: true for valid input", () => {
      const schema = z.object({ score: z.number().min(0).max(1) });
      const adapter = createZodAdapter(schema);
      const result = adapter.safeParse({ score: 0.8 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data).toEqual({ score: 0.8 });
    });

    it("returns success: false with error message for invalid input", () => {
      const schema = z.object({ score: z.number().max(1) });
      const adapter = createZodAdapter(schema);
      const result = adapter.safeParse({ score: 1.5 });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("score");
      }
    });

    it("formats multiple errors clearly", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        email: z.string().email(),
      });
      const adapter = createZodAdapter(schema);
      const result = adapter.safeParse({ name: 123, age: "old", email: "not-an-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        // should have multiple error lines
        const lines = result.error.split("\n").filter(Boolean);
        expect(lines.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe("jsonSchema", () => {
    it("generates correct JSON Schema for a simple object", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
        active: z.boolean(),
      });
      const adapter = createZodAdapter(schema);
      expect(adapter.jsonSchema.type).toBe("object");
      expect(adapter.jsonSchema.properties).toHaveProperty("name");
      expect(adapter.jsonSchema.properties).toHaveProperty("age");
      expect(adapter.jsonSchema.properties).toHaveProperty("active");
    });

    it("marks required fields correctly", () => {
      const schema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });
      const adapter = createZodAdapter(schema);
      const required = adapter.jsonSchema.required as string[];
      expect(required).toContain("required");
      // optional should not be in required
      expect(required ?? []).not.toContain("optional");
    });

    it("handles enums", () => {
      const schema = z.object({
        role: z.enum(["admin", "user", "guest"]),
      });
      const adapter = createZodAdapter(schema);
      const roleSchema = adapter.jsonSchema.properties?.role;
      expect(roleSchema?.enum).toEqual(["admin", "user", "guest"]);
    });

    it("handles nested objects", () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          address: z.object({ city: z.string() }),
        }),
      });
      const adapter = createZodAdapter(schema);
      expect(adapter.jsonSchema.properties?.user?.type).toBe("object");
    });

    it("handles arrays", () => {
      const schema = z.object({ tags: z.array(z.string()) });
      const adapter = createZodAdapter(schema);
      expect(adapter.jsonSchema.properties?.tags?.type).toBe("array");
      expect(adapter.jsonSchema.properties?.tags?.items?.type).toBe("string");
    });

    it("handles nullable fields", () => {
      const schema = z.object({ bio: z.string().nullable() });
      const adapter = createZodAdapter(schema);
      // should have null in schema somehow
      const bioSchema = adapter.jsonSchema.properties?.bio;
      const schemaStr = JSON.stringify(bioSchema);
      expect(schemaStr).toMatch(/null/);
    });

    it("handles number min/max constraints", () => {
      const schema = z.object({
        score: z.number().min(0).max(100),
      });
      const adapter = createZodAdapter(schema);
      const scoreSchema = adapter.jsonSchema.properties?.score;
      expect(scoreSchema?.minimum).toBe(0);
      expect(scoreSchema?.maximum).toBe(100);
    });

    it("handles string min/max length", () => {
      const schema = z.object({
        username: z.string().min(3).max(20),
      });
      const adapter = createZodAdapter(schema);
      const usernameSchema = adapter.jsonSchema.properties?.username;
      expect(usernameSchema?.minLength).toBe(3);
      expect(usernameSchema?.maxLength).toBe(20);
    });

    it("handles union types", () => {
      const schema = z.object({
        value: z.union([z.string(), z.number()]),
      });
      const adapter = createZodAdapter(schema);
      const valueSchema = adapter.jsonSchema.properties?.value;
      expect(valueSchema?.anyOf).toBeDefined();
      expect(valueSchema?.anyOf?.length).toBe(2);
    });

    it("handles literal types", () => {
      const schema = z.object({ type: z.literal("success") });
      const adapter = createZodAdapter(schema);
      const typeSchema = adapter.jsonSchema.properties?.type;
      expect(typeSchema?.const).toBe("success");
    });

    it("handles array of objects", () => {
      const schema = z.object({
        items: z.array(z.object({ id: z.number(), name: z.string() })),
      });
      const adapter = createZodAdapter(schema);
      const itemsSchema = adapter.jsonSchema.properties?.items;
      expect(itemsSchema?.type).toBe("array");
      expect(itemsSchema?.items?.type).toBe("object");
    });
  });
});

describe("isZodSchema", () => {
  it("returns true for Zod schemas", () => {
    expect(isZodSchema(z.string())).toBe(true);
    expect(isZodSchema(z.object({ x: z.number() }))).toBe(true);
    expect(isZodSchema(z.array(z.string()))).toBe(true);
  });

  it("returns false for non-zod values", () => {
    expect(isZodSchema(null)).toBe(false);
    expect(isZodSchema({ parse: () => {}, jsonSchema: {} })).toBe(false);
    expect(isZodSchema("string")).toBe(false);
    expect(isZodSchema(42)).toBe(false);
  });
});
