import { z } from "zod";
import type { GenerateOptions, UsageInfo, ZodLike } from "./types.js";
import { generate } from "./generate.js";

// Simple field types that map to Zod schemas
export type FieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "email"
  | "phone"
  | "url"
  | "integer";

export interface FieldDef {
  type: FieldType;
  description?: string;
  required?: boolean;
  // for enum fields
  options?: string[];
}

export type FieldSpec = FieldType | FieldDef;

export type ExtractFields = Record<string, FieldSpec>;

// Infer TypeScript type from field spec
type FieldToType<F extends FieldSpec> = F extends "number" | "integer"
  ? number
  : F extends "boolean"
  ? boolean
  : F extends { type: "number" | "integer" }
  ? number
  : F extends { type: "boolean" }
  ? boolean
  : F extends { options: infer O extends string[] }
  ? O[number]
  : string;

export type ExtractResult<F extends ExtractFields> = {
  [K in keyof F]?: FieldToType<F[K]>;
};

export interface ExtractOptions<F extends ExtractFields>
  extends Omit<GenerateOptions<ZodLike>, "schema"> {
  fields: F;
  requireAll?: boolean;
}

export async function extract<F extends ExtractFields>(
  opts: ExtractOptions<F>
): Promise<ExtractResult<F> & { usage?: UsageInfo }> {
  const { fields, requireAll = false, ...rest } = opts;

  // Build a Zod schema dynamically from the field definitions
  const schemaShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, spec] of Object.entries(fields)) {
    const def: FieldDef = typeof spec === "string" ? { type: spec } : spec;
    const isRequired = requireAll || def.required === true;

    let fieldSchema: z.ZodTypeAny;

    if (def.options?.length) {
      fieldSchema = z.enum(def.options as [string, ...string[]]);
    } else {
      switch (def.type) {
        case "number":
          fieldSchema = z.number();
          break;
        case "integer":
          fieldSchema = z.number().int();
          break;
        case "boolean":
          fieldSchema = z.boolean();
          break;
        case "email":
          fieldSchema = z.string().email();
          break;
        case "url":
          fieldSchema = z.string().url();
          break;
        case "date":
          fieldSchema = z.string().describe("ISO 8601 date string");
          break;
        default:
          fieldSchema = z.string();
      }
    }

    if (def.description) {
      fieldSchema = fieldSchema.describe(def.description);
    }

    schemaShape[key] = isRequired ? fieldSchema : fieldSchema.optional();
  }

  const schema = z.object(schemaShape);

  const fieldDescriptions = Object.entries(fields)
    .map(([key, spec]) => {
      const def = typeof spec === "string" ? { type: spec } : spec;
      return `- ${key} (${def.description ?? def.type})`;
    })
    .join("\n");

  const result = await generate({
    ...rest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: schema as any,
    systemPrompt: rest.systemPrompt
      ? rest.systemPrompt
      : `Extract the following fields from the provided text:\n${fieldDescriptions}\nIf a field cannot be found, omit it.`,
  });

  return { ...(result.data as ExtractResult<F>), usage: result.usage };
}
