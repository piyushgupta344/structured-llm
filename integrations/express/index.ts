import type { z } from "zod";
import type { GenerateOptions, ZodLike } from "../../src/types.js";
import { generate } from "../../src/generate.js";
import { generateStream } from "../../src/generate-stream.js";

// Minimal Express types — avoids requiring @types/express as a dependency
interface ExpressRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structured?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structuredUsage?: any;
}

interface ExpressResponse {
  status(code: number): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json(data: any): this;
  setHeader(key: string, value: string): this;
  write(data: string): boolean;
  end(data?: string): this;
  headersSent: boolean;
}

type NextFn = (err?: unknown) => void;

export interface StructuredMiddlewareOptions<TSchema extends ZodLike>
  extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptFromBody?: (body: any) => string;
  onError?: (err: Error, req: ExpressRequest, res: ExpressResponse, next: NextFn) => void;
}

// structuredMiddleware attaches the result to req.structured and calls next().
//
// Usage:
//   app.post('/extract',
//     structuredMiddleware({ provider: 'openai', model: 'gpt-4o-mini', schema: MySchema,
//                            promptFromBody: (b) => b.text }),
//     (req, res) => res.json(req.structured)
//   );
export function structuredMiddleware<TSchema extends ZodLike>(
  options: StructuredMiddlewareOptions<TSchema>
) {
  const { promptFromBody, onError, ...generateOptions } = options;

  return async (req: ExpressRequest, res: ExpressResponse, next: NextFn) => {
    try {
      const prompt = promptFromBody ? promptFromBody(req.body) : req.body?.prompt;
      const messages = !promptFromBody ? req.body?.messages : undefined;
      const { data, usage } = await generate({ ...generateOptions, prompt, messages });
      req.structured = data;
      req.structuredUsage = usage;
      next();
    } catch (err) {
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)), req, res, next);
      } else {
        res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
      }
    }
  };
}

// createStructuredHandler returns an Express route handler (no middleware chaining).
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
  return async (req: ExpressRequest, res: ExpressResponse, next?: NextFn) => {
    const body = req.body as { prompt?: string; messages?: unknown[]; systemPrompt?: string } | null;

    if (!body?.prompt && !body?.messages?.length) {
      res.status(400).json({ error: 'Request body must include "prompt" or "messages"' });
      return;
    }

    try {
      const result = await generate({
        ...config,
        prompt: body.prompt,
        messages: body.messages as GenerateOptions<TSchema>["messages"],
        systemPrompt: body.systemPrompt ?? (config as GenerateOptions<TSchema>).systemPrompt,
      });
      res.json(result);
    } catch (err) {
      if (next) {
        next(err);
      } else {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      }
    }
  };
}

// createStreamingHandler returns an Express route handler that streams NDJSON events.
//
// Usage:
//   app.post("/stream", createStreamingHandler({ provider: "openai", model: "gpt-4o", schema: ReportSchema }));
export function createStreamingHandler<TSchema extends ZodLike>(
  config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">
) {
  return async (req: ExpressRequest, res: ExpressResponse, next?: NextFn) => {
    const body = req.body as { prompt?: string; messages?: unknown[]; systemPrompt?: string } | null;

    if (!body?.prompt && !body?.messages?.length) {
      res.status(400).json({ error: 'Request body must include "prompt" or "messages"' });
      return;
    }

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      const llmStream = generateStream({
        ...config,
        prompt: body.prompt,
        messages: body.messages as GenerateOptions<TSchema>["messages"],
        systemPrompt: body.systemPrompt ?? (config as GenerateOptions<TSchema>).systemPrompt,
      });

      for await (const event of llmStream) {
        res.write(JSON.stringify(event) + "\n");
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        if (next) {
          next(err);
        } else {
          res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
        }
      } else {
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) + "\n");
      }
    }
  };
}

// extractFromBody — inline helper without middleware
export async function extractFromBody<TSchema extends ZodLike>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  options: StructuredMiddlewareOptions<TSchema>
): Promise<z.infer<TSchema>> {
  const { promptFromBody, onError: _ignored, ...generateOptions } = options;
  const prompt = promptFromBody ? promptFromBody(body) : body?.prompt;
  const { data } = await generate({ ...generateOptions, prompt });
  return data;
}

// Declare module augmentation for Express so req.structured is typed
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      structured?: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      structuredUsage?: any;
    }
  }
}
