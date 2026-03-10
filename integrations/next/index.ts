import type { z } from "zod";
import type { GenerateOptions, ZodLike } from "../../src/types.js";
import { generate } from "../../src/generate.js";

// Usage:
//   export const analyzeReview = withStructured({ provider: 'openai', model: 'gpt-4o-mini', schema: ReviewSchema });
//   // In a React component:
//   const result = await analyzeReview({ prompt: 'Review: Great product!' });

export function withStructured<TSchema extends ZodLike>(
  config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">
) {
  return async function (
    input: { prompt?: string; messages?: GenerateOptions<TSchema>["messages"] }
  ): Promise<z.infer<TSchema>> {
    const { data } = await generate({ ...config, ...input });
    return data;
  };
}

// Usage in a Next.js route handler:
//   export const POST = structuredRoute({ provider: 'openai', model: 'gpt-4o-mini', schema: MySchema });

export function structuredRoute<TSchema extends ZodLike>(
  config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">
) {
  return async function (req: Request): Promise<Response> {
    try {
      const body = await req.json() as { prompt?: string };
      if (!body.prompt) {
        return Response.json({ error: "prompt is required" }, { status: 400 });
      }
      const { data, usage } = await generate({ ...config, prompt: body.prompt });
      return Response.json({ data, usage });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
