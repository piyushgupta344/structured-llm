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
// When model is set at client-creation time it is optional per-call (can be overridden).
// model must be removed from T first, then re-added as optional, because intersection
// of `{ model: string } & { model?: string }` resolves to `{ model: string }` (still required).
type ClientOptions<T> = Omit<T, BoundOmit | "model"> & { model?: string };

export interface StructuredLLMClient {
  generate<TSchema extends ZodLike>(
    options: ClientOptions<GenerateOptions<TSchema>>
  ): Promise<GenerateResult<z.infer<TSchema>>>;

  generateArray<TSchema extends ZodLike>(
    options: ClientOptions<GenerateArrayOptions<TSchema>>
  ): Promise<GenerateArrayResult<z.infer<TSchema>>>;

  generateStream<TSchema extends ZodLike>(
    options: ClientOptions<GenerateStreamOptions<TSchema>>
  ): AsyncIterable<StreamEvent<z.infer<TSchema>>> & {
    result: Promise<{ data: z.infer<TSchema>; usage?: UsageInfo }>;
  };

  generateBatch<TSchema extends ZodLike>(
    options: ClientOptions<BatchOptions<TSchema>>
  ): Promise<BatchResult<z.infer<TSchema>>>;

  classify(
    options: ClientOptions<ClassifyOptions>
  ): Promise<ClassifyResult>;

  extract<F extends ExtractFields>(
    options: ClientOptions<ExtractOptions<F>>
  ): Promise<ExtractResult<F>>;

  generateMultiSchema<M extends SchemaMap>(
    options: ClientOptions<GenerateMultiSchemaOptions<M>>
  ): Promise<MultiSchemaResults<M>>;
}

export function createClient(clientOptions: CreateClientOptions): StructuredLLMClient {
  const { client, provider, apiKey, baseURL, model: defaultModel, defaultOptions = {} } = clientOptions;

  function mergeOptions<T extends ZodLike>(
    opts: ClientOptions<GenerateOptions<T>>
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
      opts: ClientOptions<GenerateOptions<TSchema>>
    ) {
      return generate(mergeOptions(opts));
    },

    generateArray<TSchema extends ZodLike>(
      opts: ClientOptions<GenerateArrayOptions<TSchema>>
    ) {
      return generateArray(mergeOptions(opts) as GenerateArrayOptions<TSchema>);
    },

    generateStream<TSchema extends ZodLike>(
      opts: ClientOptions<GenerateStreamOptions<TSchema>>
    ) {
      return generateStream(mergeOptions(opts));
    },

    generateBatch<TSchema extends ZodLike>(
      opts: ClientOptions<BatchOptions<TSchema>>
    ) {
      return generateBatch({ ...mergeOptions({ model: opts.model ?? defaultModel ?? "" } as ClientOptions<GenerateOptions<TSchema>>), ...opts } as BatchOptions<TSchema>);
    },

    classify(opts: ClientOptions<ClassifyOptions>) {
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

    extract<F extends ExtractFields>(opts: ClientOptions<ExtractOptions<F>>) {
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
      opts: ClientOptions<GenerateMultiSchemaOptions<M>>
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
