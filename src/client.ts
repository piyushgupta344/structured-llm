import type { z } from "zod";
import type {
  CreateClientOptions,
  GenerateArrayOptions,
  GenerateArrayResult,
  GenerateOptions,
  GenerateResult,
  GenerateStreamOptions,
  StreamEvent,
  UsageInfo,
  ZodLike,
} from "./types.js";
import { generate } from "./generate.js";
import { generateArray } from "./generate-array.js";
import { generateStream } from "./generate-stream.js";
import { generateBatch } from "./generate-batch.js";
import type { BatchOptions, BatchResult } from "./generate-batch.js";
import { classify } from "./classify.js";
import type { ClassifyOptions, ClassifyResult } from "./classify.js";
import { extract } from "./extract.js";
import type { ExtractFields, ExtractOptions, ExtractResult } from "./extract.js";
import { generateMultiSchema } from "./generate-multi-schema.js";
import type { GenerateMultiSchemaOptions, MultiSchemaResults, SchemaMap } from "./generate-multi-schema.js";

type BoundOmit = "client" | "provider" | "apiKey" | "baseURL";

export interface StructuredLLMClient {
  generate<TSchema extends ZodLike>(
    options: Omit<GenerateOptions<TSchema>, BoundOmit>
  ): Promise<GenerateResult<z.infer<TSchema>>>;

  generateArray<TSchema extends ZodLike>(
    options: Omit<GenerateArrayOptions<TSchema>, BoundOmit>
  ): Promise<GenerateArrayResult<z.infer<TSchema>>>;

  generateStream<TSchema extends ZodLike>(
    options: Omit<GenerateStreamOptions<TSchema>, BoundOmit>
  ): AsyncIterable<StreamEvent<z.infer<TSchema>>> & {
    result: Promise<{ data: z.infer<TSchema>; usage?: UsageInfo }>;
  };

  generateBatch<TSchema extends ZodLike>(
    options: Omit<BatchOptions<TSchema>, BoundOmit>
  ): Promise<BatchResult<z.infer<TSchema>>>;

  classify(
    options: Omit<ClassifyOptions, BoundOmit>
  ): Promise<ClassifyResult>;

  extract<F extends ExtractFields>(
    options: Omit<ExtractOptions<F>, BoundOmit>
  ): Promise<ExtractResult<F>>;

  generateMultiSchema<M extends SchemaMap>(
    options: Omit<GenerateMultiSchemaOptions<M>, BoundOmit>
  ): Promise<MultiSchemaResults<M>>;
}

export function createClient(clientOptions: CreateClientOptions): StructuredLLMClient {
  const { client, provider, apiKey, baseURL, model: defaultModel, defaultOptions = {} } = clientOptions;

  function mergeOptions<T extends ZodLike>(
    opts: Omit<GenerateOptions<T>, BoundOmit>
  ): GenerateOptions<T> {
    const resolvedModel = (opts as GenerateOptions<T>).model ?? defaultModel ?? "";
    return {
      client,
      provider,
      apiKey,
      baseURL,
      ...defaultOptions,
      ...opts,
      model: resolvedModel,
      hooks: mergeHooks(defaultOptions.hooks, opts.hooks),
    } as GenerateOptions<T>;
  }

  return {
    generate<TSchema extends ZodLike>(
      opts: Omit<GenerateOptions<TSchema>, BoundOmit>
    ) {
      return generate(mergeOptions(opts));
    },

    generateArray<TSchema extends ZodLike>(
      opts: Omit<GenerateArrayOptions<TSchema>, BoundOmit>
    ) {
      return generateArray(mergeOptions(opts) as GenerateArrayOptions<TSchema>);
    },

    generateStream<TSchema extends ZodLike>(
      opts: Omit<GenerateStreamOptions<TSchema>, BoundOmit>
    ) {
      return generateStream(mergeOptions(opts));
    },

    generateBatch<TSchema extends ZodLike>(
      opts: Omit<BatchOptions<TSchema>, BoundOmit>
    ) {
      return generateBatch({ ...mergeOptions({ model: opts.model ?? defaultModel ?? "" } as Omit<GenerateOptions<TSchema>, BoundOmit>), ...opts } as BatchOptions<TSchema>);
    },

    classify(opts: Omit<ClassifyOptions, BoundOmit>) {
      const resolvedModel = opts.model ?? defaultModel ?? "";
      return classify({
        client,
        provider,
        apiKey,
        baseURL,
        ...defaultOptions,
        ...opts,
        model: resolvedModel,
      } as ClassifyOptions);
    },

    extract<F extends ExtractFields>(opts: Omit<ExtractOptions<F>, BoundOmit>) {
      const resolvedModel = opts.model ?? defaultModel ?? "";
      return extract({
        client,
        provider,
        apiKey,
        baseURL,
        ...defaultOptions,
        ...opts,
        model: resolvedModel,
      } as ExtractOptions<F>);
    },

    generateMultiSchema<M extends SchemaMap>(
      opts: Omit<GenerateMultiSchemaOptions<M>, BoundOmit>
    ) {
      return generateMultiSchema({
        ...mergeOptions({ model: opts.model ?? defaultModel ?? "" } as Omit<GenerateOptions<ZodLike>, BoundOmit>),
        ...opts,
      } as GenerateMultiSchemaOptions<M>);
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeHooks(global?: any, local?: any) {
  if (!global) return local;
  if (!local) return global;

  const keys = new Set([...Object.keys(global), ...Object.keys(local)]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged: any = {};
  for (const key of keys) {
    const g = global[key];
    const l = local[key];
    if (g && l) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      merged[key] = async (ctx: any) => {
        await g(ctx);
        await l(ctx);
      };
    } else {
      merged[key] = g ?? l;
    }
  }
  return merged;
}
