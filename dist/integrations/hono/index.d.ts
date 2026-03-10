import { z } from 'zod';
import { Z as ZodLike, G as GenerateOptions } from '../../types-BPvyU1tv.js';

interface StructuredLLMMiddlewareOptions<TSchema extends ZodLike> extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
    promptFromBody?: (body: any) => string;
}
declare function structuredLLM<TSchema extends ZodLike>(options: StructuredLLMMiddlewareOptions<TSchema>): (c: any, next: () => Promise<void>) => Promise<any>;
declare function extractFromRequest<TSchema extends ZodLike>(c: any, options: StructuredLLMMiddlewareOptions<TSchema>): Promise<z.infer<TSchema>>;

export { type StructuredLLMMiddlewareOptions, extractFromRequest, structuredLLM };
