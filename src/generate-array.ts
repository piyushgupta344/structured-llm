import type { z } from "zod";
import type { GenerateArrayOptions, GenerateArrayResult, ZodLike } from "./types.js";
import { generate } from "./generate.js";
import { SchemaError } from "./errors.js";

// Wraps the item schema in a { items: [] } wrapper schema for extraction
export async function generateArray<TSchema extends ZodLike>(
  options: GenerateArrayOptions<TSchema>
): Promise<GenerateArrayResult<z.infer<TSchema>>> {
  // lazy import zod to detect version
  let wrapperSchema: ZodLike;
  try {
    const { z } = await import("zod");
    wrapperSchema = z.object({ items: z.array(options.schema) });
  } catch {
    throw new SchemaError("zod must be available to use generateArray");
  }

  const { minItems, maxItems, prompt, systemPrompt, ...rest } = options;

  // Build prompt with array hints
  const arrayHint = [
    minItems != null ? `Include at least ${minItems} items.` : "",
    maxItems != null ? `Include at most ${maxItems} items.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const enhancedPrompt = prompt
    ? `${prompt}\n\nReturn the results as an array under the "items" key.${arrayHint ? " " + arrayHint : ""}`
    : undefined;

  const enhancedSystem = systemPrompt
    ? `${systemPrompt}\nAlways return an array of results under the "items" key.`
    : "Return an array of results under the \"items\" key.";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await generate({
    ...(rest as any),
    schema: wrapperSchema,
    prompt: enhancedPrompt,
    systemPrompt: enhancedSystem,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (result.data as any).items ?? [];

  return {
    data: items as z.infer<TSchema>[],
    usage: result.usage,
  };
}
