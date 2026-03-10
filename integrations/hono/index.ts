import type { z } from "zod";
import type { GenerateOptions, ZodLike } from "../../src/types.js";
import { generate } from "../../src/generate.js";

// Hono middleware for structured LLM extraction.
//
// Usage:
//   app.post('/analyze', structuredLLM({
//     provider: 'openai',
//     model: 'gpt-4o-mini',
//     schema: AnalysisSchema,
//     promptFromBody: (body) => body.text,
//   }), (c) => c.json(c.get('structuredResult')));

export interface StructuredLLMMiddlewareOptions<TSchema extends ZodLike>
  extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptFromBody?: (body: any) => string;
}

export function structuredLLM<TSchema extends ZodLike>(
  options: StructuredLLMMiddlewareOptions<TSchema>
) {
  const { promptFromBody, ...generateOptions } = options;

  // Return a Hono-compatible middleware function
  // We type it as `any` to avoid requiring hono as a dependency
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (c: any, next: () => Promise<void>) => {
    try {
      let prompt: string | undefined;
      if (promptFromBody) {
        const body = await c.req.json();
        prompt = promptFromBody(body);
      }

      const { data, usage } = await generate({ ...generateOptions, prompt });
      c.set("structuredResult", data);
      c.set("structuredUsage", usage);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Structured LLM error";
      return c.json({ error: message }, 500);
    }
  };
}

// Simpler helper when you just want the result directly
export async function extractFromRequest<TSchema extends ZodLike>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: any,
  options: StructuredLLMMiddlewareOptions<TSchema>
): Promise<z.infer<TSchema>> {
  const { promptFromBody, ...generateOptions } = options;
  let prompt: string | undefined;
  if (promptFromBody) {
    const body = await c.req.json();
    prompt = promptFromBody(body);
  }
  const { data } = await generate({ ...generateOptions, prompt });
  return data;
}
