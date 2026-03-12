import type { z } from "zod";
import type { GenerateOptions, ZodLike } from "../../src/types.js";
import { generate } from "../../src/generate.js";
import { generateStream } from "../../src/generate-stream.js";

// Minimal Hono context interface — avoids requiring hono as a peer dependency at the type level.
// Cast to `any` if you want stricter Hono types in your own code.
interface HonoContext {
  req: {
    json<T = unknown>(): Promise<T>;
    raw: Request;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(data: unknown, status?: number): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body(data: ReadableStream, status?: number, headers?: Record<string, string>): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(key: string, value: unknown): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: string): any;
}

// structuredLLM is a Hono middleware that runs structured generation and
// stores the result in the context as "structuredResult" and "structuredUsage".
//
// Usage:
//   app.post('/analyze',
//     structuredLLM({ provider: 'openai', model: 'gpt-4o-mini', schema: AnalysisSchema,
//                     promptFromBody: (b) => b.text }),
//     (c) => c.json(c.get('structuredResult'))
//   );
export interface StructuredLLMMiddlewareOptions<TSchema extends ZodLike>
  extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptFromBody?: (body: any) => string;
}

export function structuredLLM<TSchema extends ZodLike>(
  options: StructuredLLMMiddlewareOptions<TSchema>
) {
  const { promptFromBody, ...generateOptions } = options;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (c: HonoContext, next: () => Promise<void>) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let prompt: string | undefined;
      let messages: GenerateOptions<TSchema>["messages"] | undefined;

      if (promptFromBody) {
        const body = await c.req.json();
        prompt = promptFromBody(body);
      } else {
        const body = await c.req.json<{ prompt?: string; messages?: unknown[] }>();
        prompt = body.prompt;
        messages = body.messages as GenerateOptions<TSchema>["messages"];
      }

      const { data, usage } = await generate({
        ...generateOptions,
        prompt,
        messages,
        signal: c.req.raw?.signal,
      });
      c.set("structuredResult", data);
      c.set("structuredUsage", usage);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Structured LLM error";
      return c.json({ error: message }, 500);
    }
  };
}

// createStructuredHandler returns a Hono route handler for structured generation.
//
// Usage:
//   app.post("/analyze", createStructuredHandler({
//     provider: "openai",
//     model: "gpt-4o-mini",
//     schema: AnalysisSchema,
//   }));
export function createStructuredHandler<TSchema extends ZodLike>(
  config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">
) {
  return async (c: HonoContext) => {
    let body: { prompt?: string; messages?: unknown[]; systemPrompt?: string };
    try {
      body = await c.req.json<typeof body>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body?.prompt && !body?.messages?.length) {
      return c.json({ error: 'Request body must include "prompt" or "messages"' }, 400);
    }

    try {
      const result = await generate({
        ...config,
        prompt: body.prompt,
        messages: body.messages as GenerateOptions<TSchema>["messages"],
        systemPrompt: body.systemPrompt ?? (config as GenerateOptions<TSchema>).systemPrompt,
        signal: c.req.raw?.signal,
      });
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  };
}

// createStreamingHandler returns a Hono route handler that streams NDJSON events.
export function createStreamingHandler<TSchema extends ZodLike>(
  config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">
) {
  return async (c: HonoContext) => {
    let body: { prompt?: string; messages?: unknown[]; systemPrompt?: string };
    try {
      body = await c.req.json<typeof body>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body?.prompt && !body?.messages?.length) {
      return c.json({ error: 'Request body must include "prompt" or "messages"' }, 400);
    }

    const llmStream = generateStream({
      ...config,
      prompt: body.prompt,
      messages: body.messages as GenerateOptions<TSchema>["messages"],
      systemPrompt: body.systemPrompt ?? (config as GenerateOptions<TSchema>).systemPrompt,
      signal: c.req.raw?.signal,
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

    return c.body(readable, 200, {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    });
  };
}

// Simpler helper for inline use without middleware
export async function extractFromRequest<TSchema extends ZodLike>(
  c: HonoContext,
  options: StructuredLLMMiddlewareOptions<TSchema>
): Promise<z.infer<TSchema>> {
  const { promptFromBody, ...generateOptions } = options;
  let prompt: string | undefined;
  if (promptFromBody) {
    const body = await c.req.json();
    prompt = promptFromBody(body);
  }
  const { data } = await generate({ ...generateOptions, prompt, signal: c.req.raw?.signal });
  return data;
}
