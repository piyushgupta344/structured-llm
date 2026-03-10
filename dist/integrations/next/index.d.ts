import { z } from 'zod';
import { Z as ZodLike, G as GenerateOptions } from '../../types-BPvyU1tv.js';

declare function withStructured<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (input: {
    prompt?: string;
    messages?: GenerateOptions<TSchema>["messages"];
}) => Promise<z.infer<TSchema>>;
declare function structuredRoute<TSchema extends ZodLike>(config: Omit<GenerateOptions<TSchema>, "prompt" | "messages">): (req: Request) => Promise<Response>;

export { structuredRoute, withStructured };
