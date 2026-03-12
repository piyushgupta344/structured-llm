import type { JSONSchema, SchemaAdapter } from "../../types.js";

// Standard Schema v1 protocol (https://standardschema.dev)
interface StandardSchemaV1<TInput = unknown, TOutput = TInput> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => StandardResult<TOutput> | Promise<StandardResult<TOutput>>;
    readonly types?: {
      readonly input: TInput;
      readonly output: TOutput;
    };
  };
}

type StandardResult<T> =
  | { readonly value: T; readonly issues?: undefined }
  | {
      readonly issues: ReadonlyArray<{
        readonly message: string;
        readonly path?: ReadonlyArray<string | number | { readonly key: string | number }>;
      }>;
    };

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  if (typeof value !== "object" || value === null) return false;
  const std = (value as StandardSchemaV1)["~standard"];
  return (
    typeof std === "object" &&
    std !== null &&
    std.version === 1 &&
    typeof std.validate === "function"
  );
}

export function createStandardSchemaAdapter<T>(schema: StandardSchemaV1<unknown, T>): SchemaAdapter<T> {
  return {
    jsonSchema: extractJsonSchema(schema),

    parse(data: unknown): T {
      const result = schema["~standard"].validate(data);
      if (result instanceof Promise) {
        throw new Error("Async Standard Schema validation is not supported synchronously");
      }
      if (result.issues) {
        const msg = result.issues
          .map((i) => {
            const path = i.path
              ?.map((p) => (typeof p === "object" ? p.key : p))
              .join(".") ?? "root";
            return `${path}: ${i.message}`;
          })
          .join("\n");
        throw new Error(msg);
      }
      return result.value;
    },

    safeParse(data: unknown) {
      const result = schema["~standard"].validate(data);
      if (result instanceof Promise) {
        return { success: false as const, error: "Async Standard Schema validation not supported" };
      }
      if (result.issues) {
        const error = result.issues
          .map((i) => {
            const path = i.path
              ?.map((p) => (typeof p === "object" ? p.key : p))
              .join(".") ?? "root";
            return `- ${path}: ${i.message}`;
          })
          .join("\n");
        return { success: false as const, error };
      }
      return { success: true as const, data: result.value };
    },
  };
}

// Extract JSON Schema from a Standard Schema instance.
// Libraries like Valibot and ArkType expose this in different ways.
function extractJsonSchema(schema: unknown): JSONSchema {
  if (typeof schema !== "object" || schema === null) return {};
  const s = schema as Record<string, unknown>;

  // Direct jsonSchema property
  if (s["jsonSchema"] && typeof s["jsonSchema"] === "object") {
    return s["jsonSchema"] as JSONSchema;
  }

  // ArkType exposes .json
  if (s["json"] && typeof s["json"] === "object") {
    return s["json"] as JSONSchema;
  }

  // Some libraries expose it on ~standard
  const std = s["~standard"] as Record<string, unknown> | undefined;
  if (std?.["schema"] && typeof std["schema"] === "object") {
    return std["schema"] as JSONSchema;
  }

  // No JSON schema found — return empty object; LLM will still work but without schema constraints
  return {};
}

// Convenience wrapper: converts a Standard Schema to a CustomSchema usable with generate()
export function fromStandardSchema<T>(schema: StandardSchemaV1<unknown, T>) {
  const adapter = createStandardSchemaAdapter(schema);
  return {
    jsonSchema: adapter.jsonSchema,
    parse: adapter.parse,
    safeParse: adapter.safeParse,
  };
}
