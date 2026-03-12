import { z } from 'zod';
import { Z as ZodLike, G as GenerateOptions } from '../../types-9ulo9m3c.js';

interface HonoContext {
    req: {
        json<T = unknown>(): Promise<T>;
        raw: Request;
        [key: string]: any;
    };
    json(data: unknown, status?: number): any;
    body(data: ReadableStream, status?: number, headers?: Record<string, string>): any;
    set(key: string, value: unknown): any;
    get(key: string): any;
}
interface StructuredLLMMiddlewareOptions<TSchema extends ZodLike> extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
    promptFromBody?: (body: any) => string;
}
declare function structuredLLM<TSchema extends ZodLike>(options: StructuredLLMMiddlewareOptions<TSchema>): (c: HonoContext, next: () => Promise<void>) => Promise<any>;
declare function createStructuredHandler<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (c: HonoContext) => Promise<any>;
declare function createStreamingHandler<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (c: HonoContext) => Promise<any>;
declare function extractFromRequest<TSchema extends ZodLike>(c: HonoContext, options: StructuredLLMMiddlewareOptions<TSchema>): Promise<z.infer<TSchema>>;

export { type StructuredLLMMiddlewareOptions, createStreamingHandler, createStructuredHandler, extractFromRequest, structuredLLM };
