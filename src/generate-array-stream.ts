import type { z } from "zod";
import type { GenerateArrayOptions, UsageInfo, ZodLike } from "./types.js";
import { generateStream } from "./generate-stream.js";
import { SchemaError } from "./errors.js";

export interface ArrayStreamEvent<T> {
  items: T[];
  isDone: boolean;
  usage?: UsageInfo;
}

// generateArrayStream streams array items as they are completed during generation.
// Each event contains the cumulative list of fully-parsed items seen so far.
//
// Usage:
//   const stream = generateArrayStream({ model, schema: ItemSchema, prompt, ... });
//   for await (const { items, isDone } of stream) {
//     console.log(`${items.length} items so far`);
//   }
//   const { data } = await stream.result;
export function generateArrayStream<TSchema extends ZodLike>(
  options: GenerateArrayOptions<TSchema>
): AsyncIterable<ArrayStreamEvent<z.infer<TSchema>>> & {
  result: Promise<{ data: z.infer<TSchema>[]; usage?: UsageInfo }>;
} {
  let resolveResult!: (v: { data: z.infer<TSchema>[]; usage?: UsageInfo }) => void;
  let rejectResult!: (e: Error) => void;
  const resultPromise = new Promise<{ data: z.infer<TSchema>[]; usage?: UsageInfo }>((res, rej) => {
    resolveResult = res;
    rejectResult = rej;
  });

  const events: ArrayStreamEvent<z.infer<TSchema>>[] = [];
  let done = false;
  let waiting: (() => void) | null = null;

  function notify() {
    if (waiting) { waiting(); waiting = null; }
  }

  async function run() {
    try {
      let wrapperSchema: ZodLike;
      try {
        const { z } = await import("zod");
        wrapperSchema = z.object({ items: z.array(options.schema) });
      } catch {
        throw new SchemaError("zod must be available to use generateArrayStream");
      }

      const { minItems, maxItems, prompt, systemPrompt, ...rest } = options;

      const arrayHint = [
        minItems != null ? `Include at least ${minItems} items.` : "",
        maxItems != null ? `Include at most ${maxItems} items.` : "",
      ]
        .filter(Boolean)
        .join(" ");

      const enhancedPrompt = prompt
        ? `${prompt}\n\nReturn the results as an array under the "items" key.${arrayHint ? " " + arrayHint : ""}`
        : undefined;

      const enhancedSystem = systemPrompt
        ? `${systemPrompt}\nAlways return an array of results under the "items" key.`
        : `Return an array of results under the "items" key.`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = generateStream({
        ...(rest as any),
        schema: wrapperSchema,
        prompt: enhancedPrompt,
        systemPrompt: enhancedSystem,
      });

      let lastItemCount = 0;

      for await (const event of stream) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const items: z.infer<TSchema>[] = (event.partial as any)?.items ?? [];

        if (event.isDone) {
          events.push({ items, isDone: true, usage: event.usage });
          notify();
          done = true;
          resolveResult({ data: items, usage: event.usage });
          return;
        }

        // Only emit when new complete items appear
        if (items.length > lastItemCount) {
          lastItemCount = items.length;
          events.push({ items, isDone: false });
          notify();
        }
      }

      // Stream ended without isDone (shouldn't happen normally)
      if (!done) {
        done = true;
        notify();
        resolveResult({ data: [] });
      }
    } catch (err) {
      done = true;
      notify();
      const e = err instanceof Error ? err : new Error(String(err));
      rejectResult(e);
    }
  }

  run();

  const iterable: AsyncIterable<ArrayStreamEvent<z.infer<TSchema>>> = {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          while (index >= events.length && !done) {
            await new Promise<void>((r) => { waiting = r; });
          }
          if (index < events.length) {
            return { value: events[index++], done: false };
          }
          return { value: undefined as unknown as ArrayStreamEvent<z.infer<TSchema>>, done: true };
        },
      };
    },
  };

  return Object.assign(iterable, { result: resultPromise });
}
