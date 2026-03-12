import type { SchemaAdapter } from "../types.js";
import { createZodAdapter, isZodSchema } from "./adapters/zod.js";
import { isStandardSchema, createStandardSchemaAdapter } from "./adapters/standard-schema.js";
import { SchemaError } from "../errors.js";

// Custom schema — user brings their own jsonSchema + parse function
export interface CustomSchema<T = unknown> {
  jsonSchema: Record<string, unknown>;
  parse: (data: unknown) => T;
  safeParse?: (data: unknown) => { success: true; data: T } | { success: false; error: string };
}

export function isCustomSchema(value: unknown): value is CustomSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "jsonSchema" in value &&
    "parse" in value &&
    typeof (value as CustomSchema).parse === "function"
  );
}

function createCustomAdapter<T>(schema: CustomSchema<T>): SchemaAdapter<T> {
  return {
    jsonSchema: schema.jsonSchema as SchemaAdapter["jsonSchema"],
    parse: schema.parse,
    safeParse: schema.safeParse
      ? schema.safeParse
      : (data: unknown) => {
          try {
            return { success: true, data: schema.parse(data) };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        },
  };
}

export function resolveSchema<T>(schema: unknown): SchemaAdapter<T> {
  if (isZodSchema(schema)) {
    return createZodAdapter(schema) as SchemaAdapter<T>;
  }

  if (isStandardSchema(schema)) {
    return createStandardSchemaAdapter(schema) as SchemaAdapter<T>;
  }

  if (isCustomSchema(schema)) {
    return createCustomAdapter(schema) as SchemaAdapter<T>;
  }

  throw new SchemaError(
    "Schema must be a Zod schema, a Standard Schema (Valibot, ArkType, etc.), or a custom schema with { jsonSchema, parse }"
  );
}
