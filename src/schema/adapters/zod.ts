import type { z } from "zod";
import type { JSONSchema, SchemaAdapter } from "../../types.js";

// Zod v4 has z.toJSONSchema() built in. For v3 we do a best-effort conversion.
function toJsonSchema(schema: z.ZodType): JSONSchema {
  const z = schema as z.ZodType & { _zod?: unknown };

  // Zod v4
  if (typeof (z as unknown as Record<string, unknown>).toJSONSchema === "function") {
    return (z as unknown as { toJSONSchema: () => JSONSchema }).toJSONSchema();
  }

  // Try the static method (also Zod v4)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const zodModule = require("zod") as { toJSONSchema?: (s: unknown) => JSONSchema };
    if (typeof zodModule.toJSONSchema === "function") {
      return zodModule.toJSONSchema(schema);
    }
  } catch {
    // ignore
  }

  // Zod v3 fallback — hand-roll it
  return zodV3ToJsonSchema(schema);
}

// Basic Zod v3 → JSON Schema converter. Handles the common 90% of cases.
function zodV3ToJsonSchema(schema: z.ZodType): JSONSchema {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (schema as any)._def;
  if (!def) return {};

  const typeName: string = def.typeName ?? "";

  switch (typeName) {
    case "ZodString": {
      const s: JSONSchema = { type: "string" };
      for (const check of def.checks ?? []) {
        if (check.kind === "min") s.minLength = check.value;
        if (check.kind === "max") s.maxLength = check.value;
        if (check.kind === "regex") s.pattern = check.regex.source;
        if (check.kind === "email") s.format = "email";
        if (check.kind === "url") s.format = "uri";
      }
      return s;
    }

    case "ZodNumber": {
      const n: JSONSchema = { type: "number" };
      for (const check of def.checks ?? []) {
        if (check.kind === "min") n.minimum = check.value;
        if (check.kind === "max") n.maximum = check.value;
        if (check.kind === "int") n.type = "integer";
      }
      return n;
    }

    case "ZodBoolean":
      return { type: "boolean" };

    case "ZodNull":
      return { type: "null" };

    case "ZodUndefined":
    case "ZodNever":
      return {};

    case "ZodAny":
    case "ZodUnknown":
      return {};

    case "ZodLiteral":
      return { const: def.value };

    case "ZodEnum":
      return { type: "string", enum: def.values };

    case "ZodNativeEnum": {
      const vals = Object.values(def.values as Record<string, string | number>).filter(
        (v) => typeof v === "string" || typeof v === "number"
      );
      return { enum: vals };
    }

    case "ZodArray": {
      const arr: JSONSchema = { type: "array", items: zodV3ToJsonSchema(def.type) };
      if (def.minLength?.value != null) arr.minItems = def.minLength.value;
      if (def.maxLength?.value != null) arr.maxItems = def.maxLength.value;
      return arr;
    }

    case "ZodObject": {
      const shape = def.shape();
      const properties: Record<string, JSONSchema> = {};
      const required: string[] = [];
      for (const [key, val] of Object.entries(shape)) {
        properties[key] = zodV3ToJsonSchema(val as z.ZodType);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const innerDef = (val as any)._def;
        if (innerDef?.typeName !== "ZodOptional" && innerDef?.typeName !== "ZodDefault") {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        required: required.length ? required : undefined,
        additionalProperties: false,
      };
    }

    case "ZodOptional":
      return zodV3ToJsonSchema(def.innerType);

    case "ZodNullable": {
      const inner = zodV3ToJsonSchema(def.innerType);
      return { anyOf: [inner, { type: "null" }] };
    }

    case "ZodDefault":
      return zodV3ToJsonSchema(def.innerType);

    case "ZodEffects":
    case "ZodTransformer":
      return zodV3ToJsonSchema(def.schema);

    case "ZodUnion":
      return { anyOf: def.options.map((o: z.ZodType) => zodV3ToJsonSchema(o)) };

    case "ZodDiscriminatedUnion":
      return { anyOf: [...def.options.values()].map((o: z.ZodType) => zodV3ToJsonSchema(o)) };

    case "ZodIntersection":
      return { allOf: [zodV3ToJsonSchema(def.left), zodV3ToJsonSchema(def.right)] };

    case "ZodRecord": {
      const valSchema = def.valueType ? zodV3ToJsonSchema(def.valueType) : {};
      return { type: "object", additionalProperties: valSchema };
    }

    case "ZodTuple": {
      return {
        type: "array",
        items: def.items.map((i: z.ZodType) => zodV3ToJsonSchema(i)),
      };
    }

    default:
      return {};
  }
}

export function createZodAdapter<T>(schema: z.ZodType<T>): SchemaAdapter<T> {
  const jsonSchema = toJsonSchema(schema);

  return {
    jsonSchema,
    parse(data: unknown): T {
      return schema.parse(data);
    },
    safeParse(data: unknown) {
      const result = schema.safeParse(data);
      if (result.success) {
        return { success: true, data: result.data };
      }
      // format issues nicely for retry messages
      const errObj = result.error as z.ZodError;
      const issues = errObj.issues ?? [];
      const formatted = issues
        .map((i) => `- ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      return { success: false, error: formatted };
    },
  };
}

export function isZodSchema(value: unknown): value is z.ZodType {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as z.ZodType).safeParse === "function" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (value as any)._def === "object"
  );
}
