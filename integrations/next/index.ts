import type { z } from "zod";
import type { GenerateOptions, ZodLike } from "../../src/types.js";
import { generate } from "../../src/generate.js";
import { generateStream } from "../../src/generate-stream.js";

// withStructured creates a reusable server action / utility function bound to a config.
//
// Usage:
//   const analyzeReview = withStructured({ provider: 'openai', model: 'gpt-4o-mini', schema: ReviewSchema });
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

// createStructuredRoute returns a Next.js App Router POST handler.
// The request body should be JSON with { prompt?, messages?, systemPrompt? }.
//
// Usage:
//   // app/api/analyze/route.ts
//   export const POST = createStructuredRoute({
//     provider: "openai",
//     model: "gpt-4o-mini",
//     schema: AnalysisSchema,
//   });
export function createStructuredRoute<TSchema extends ZodLike>(
  config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">
) {
  return async function POST(request: Request): Promise<Response> {
    let body: { prompt?: string; messages?: unknown[]; systemPrompt?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body?.prompt && !body?.messages?.length) {
      return Response.json(
        { error: 'Request body must include "prompt" or "messages"' },
        { status: 400 }
      );
    }

    try {
      const result = await generate({
        ...config,
        prompt: body.prompt,
        messages: body.messages as GenerateOptions<TSchema>["messages"],
        systemPrompt: body.systemPrompt ?? (config as GenerateOptions<TSchema>).systemPrompt,
        signal: request.signal,
      });
      return Response.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = (err as { statusCode?: number }).statusCode;
      return Response.json({ error: message }, { status: status && status >= 400 ? status : 500 });
    }
  };
}

// Backwards-compatible alias
export const structuredRoute = createStructuredRoute;

// createStreamingRoute returns a Next.js App Router POST handler that streams
// NDJSON events as the LLM generates the response. Each line is a JSON-encoded
// StreamEvent ({ partial, isDone, usage? }).
//
// Usage:
//   // app/api/stream/route.ts
//   export const POST = createStreamingRoute({
//     provider: "openai",
//     model: "gpt-4o",
//     schema: ReportSchema,
//   });
export function createStreamingRoute<TSchema extends ZodLike>(
  config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">
) {
  return async function POST(request: Request): Promise<Response> {
    let body: { prompt?: string; messages?: unknown[]; systemPrompt?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body?.prompt && !body?.messages?.length) {
      return Response.json(
        { error: 'Request body must include "prompt" or "messages"' },
        { status: 400 }
      );
    }

    const llmStream = generateStream({
      ...config,
      prompt: body.prompt,
      messages: body.messages as GenerateOptions<TSchema>["messages"],
      systemPrompt: body.systemPrompt ?? (config as GenerateOptions<TSchema>).systemPrompt,
      signal: request.signal,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of llmStream) {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          }
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(JSON.stringify({ error: message }) + "\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-store",
        "X-Accel-Buffering": "no",
      },
    });
  };
}
