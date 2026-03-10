import type { z } from "zod";
import type { GenerateOptions, GenerateResult, UsageInfo, ZodLike } from "./types.js";
import { generate } from "./generate.js";

// Map of label → schema
export type SchemaMap = Record<string, ZodLike>;

// Infer result type from a SchemaMap
export type MultiSchemaResult<M extends SchemaMap> = {
  [K in keyof M]: z.infer<M[K]>;
};

export interface MultiSchemaItemResult<T> {
  data?: T;
  usage?: UsageInfo;
  error?: Error;
  durationMs: number;
}

export interface MultiSchemaResults<M extends SchemaMap> {
  results: { [K in keyof M]: MultiSchemaItemResult<z.infer<M[K]>> };
  // total aggregated usage across all schemas
  totalUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
}

export interface GenerateMultiSchemaOptions<M extends SchemaMap>
  extends Omit<GenerateOptions<ZodLike>, "schema"> {
  schemas: M;
  // run schemas in parallel (default true)
  parallel?: boolean;
  // if false, a single schema error throws immediately (default true)
  continueOnError?: boolean;
}

// generateMultiSchema runs the same prompt through multiple schemas simultaneously.
// Useful when you need different structured views of the same input, e.g.
// extracting both a summary and a list of action items from a single document.
//
// Usage:
//   const { results } = await generateMultiSchema({
//     client, model, prompt: document,
//     schemas: {
//       summary: SummarySchema,
//       actions: ActionListSchema,
//       sentiment: SentimentSchema,
//     },
//   });
//   console.log(results.summary.data, results.actions.data);

export async function generateMultiSchema<M extends SchemaMap>(
  options: GenerateMultiSchemaOptions<M>
): Promise<MultiSchemaResults<M>> {
  const { schemas, parallel = true, continueOnError = true, ...baseOpts } = options;

  const entries = Object.entries(schemas) as [keyof M, ZodLike][];

  async function runOne<T>(label: keyof M, schema: ZodLike): Promise<[keyof M, MultiSchemaItemResult<T>]> {
    const start = Date.now();
    try {
      const result = (await generate({
        ...baseOpts,
        schema,
      } as GenerateOptions<ZodLike>)) as GenerateResult<T>;
      return [label, { data: result.data, usage: result.usage, durationMs: Date.now() - start }];
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (!continueOnError) throw error;
      return [label, { error, durationMs: Date.now() - start }];
    }
  }

  let pairs: [keyof M, MultiSchemaItemResult<unknown>][];

  if (parallel) {
    pairs = await Promise.all(entries.map(([label, schema]) => runOne(label, schema)));
  } else {
    pairs = [];
    for (const [label, schema] of entries) {
      pairs.push(await runOne(label, schema));
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any = {};
  for (const [label, item] of pairs) {
    results[label] = item;
  }

  // aggregate usage
  const usageItems = pairs.filter(([, r]) => r.usage);
  const totalUsage =
    usageItems.length > 0
      ? {
          promptTokens: usageItems.reduce((s, [, r]) => s + (r.usage?.promptTokens ?? 0), 0),
          completionTokens: usageItems.reduce((s, [, r]) => s + (r.usage?.completionTokens ?? 0), 0),
          totalTokens: usageItems.reduce((s, [, r]) => s + (r.usage?.totalTokens ?? 0), 0),
          estimatedCostUsd: usageItems.reduce((s, [, r]) => s + (r.usage?.estimatedCostUsd ?? 0), 0),
        }
      : undefined;

  return { results, totalUsage };
}
