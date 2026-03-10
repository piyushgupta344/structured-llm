import { z } from 'zod';
import { Z as ZodLike, G as GenerateOptions } from '../../types-BPvyU1tv.js';

interface StructuredMiddlewareOptions<TSchema extends ZodLike> extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
    promptFromBody?: (body: any) => string;
    onError?: (err: Error, req: ExpressRequest, res: ExpressResponse, next: NextFn) => void;
}
interface ExpressRequest {
    body: any;
    structured?: any;
    structuredUsage?: any;
}
interface ExpressResponse {
    status: (code: number) => any;
    json: (data: any) => any;
}
type NextFn = (err?: unknown) => void;
declare function structuredMiddleware<TSchema extends ZodLike>(options: StructuredMiddlewareOptions<TSchema>): (req: ExpressRequest, res: ExpressResponse, next: NextFn) => Promise<void>;
declare global {
    namespace Express {
        interface Request {
            structured?: any;
            structuredUsage?: any;
        }
    }
}
declare function extractFromBody<TSchema extends ZodLike>(body: any, options: StructuredMiddlewareOptions<TSchema>): Promise<z.infer<TSchema>>;

export { type StructuredMiddlewareOptions, extractFromBody, structuredMiddleware };
