import { z } from 'zod';
import { Z as ZodLike, G as GenerateOptions } from '../../types-9ulo9m3c.js';

declare function withStructured<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (input: {
    prompt?: string;
    messages?: GenerateOptions<TSchema>["messages"];
}) => Promise<z.infer<TSchema>>;
declare function createStructuredRoute<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (request: Request) => Promise<Response>;
declare const structuredRoute: typeof createStructuredRoute;
declare function createStreamingRoute<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (request: Request) => Promise<Response>;

export { createStreamingRoute, createStructuredRoute, structuredRoute, withStructured };
