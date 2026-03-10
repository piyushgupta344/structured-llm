import type { z } from "zod";
import type { GenerateOptions, ZodLike } from "../../src/types.js";
import { generate } from "../../src/generate.js";

// Express middleware for structured LLM extraction.
//
// Usage:
//   app.post('/extract', structuredMiddleware({
//     provider: 'openai',
//     model: 'gpt-4o-mini',
//     schema: ExtractionSchema,
//     promptFromBody: (body) => body.text,
//   }), (req, res) => res.json(req.structured));

export interface StructuredMiddlewareOptions<TSchema extends ZodLike>
  extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  promptFromBody?: (body: any) => string;
  onError?: (err: Error, req: ExpressRequest, res: ExpressResponse, next: NextFn) => void;
}

// Minimal Express types to avoid requiring express as a dependency
interface ExpressRequest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structured?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  structuredUsage?: any;
}
interface ExpressResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  status: (code: number) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: (data: any) => any;
}
type NextFn = (err?: unknown) => void;

export function structuredMiddleware<TSchema extends ZodLike>(
  options: StructuredMiddlewareOptions<TSchema>
) {
  const { promptFromBody, onError, ...generateOptions } = options;

  return async (req: ExpressRequest, res: ExpressResponse, next: NextFn) => {
    try {
      const prompt = promptFromBody ? promptFromBody(req.body) : req.body?.prompt;
      const { data, usage } = await generate({ ...generateOptions, prompt });
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

// helper for inline usage without middleware
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
