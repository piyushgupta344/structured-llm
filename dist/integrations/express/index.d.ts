import { z } from 'zod';
import { Z as ZodLike, G as GenerateOptions } from '../../types-9ulo9m3c.js';

interface ExpressRequest {
    body: any;
    structured?: any;
    structuredUsage?: any;
}
interface ExpressResponse {
    status(code: number): this;
    json(data: any): this;
    setHeader(key: string, value: string): this;
    write(data: string): boolean;
    end(data?: string): this;
    headersSent: boolean;
}
type NextFn = (err?: unknown) => void;
interface StructuredMiddlewareOptions<TSchema extends ZodLike> extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
    promptFromBody?: (body: any) => string;
    onError?: (err: Error, req: ExpressRequest, res: ExpressResponse, next: NextFn) => void;
}
declare function structuredMiddleware<TSchema extends ZodLike>(options: StructuredMiddlewareOptions<TSchema>): (req: ExpressRequest, res: ExpressResponse, next: NextFn) => Promise<void>;
declare function createStructuredHandler<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (req: ExpressRequest, res: ExpressResponse, next?: NextFn) => Promise<void>;
declare function createStreamingHandler<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (req: ExpressRequest, res: ExpressResponse, next?: NextFn) => Promise<void>;
declare function extractFromBody<TSchema extends ZodLike>(body: any, options: StructuredMiddlewareOptions<TSchema>): Promise<z.infer<TSchema>>;
declare global {
    namespace Express {
        interface Request {
            structured?: any;
            structuredUsage?: any;
        }
    }
}

export { type StructuredMiddlewareOptions, createStreamingHandler, createStructuredHandler, extractFromBody, structuredMiddleware };
