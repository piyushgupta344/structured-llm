import type { z } from "zod";
import type { GenerateOptions, GenerateResult, UsageInfo, ZodLike } from "./types.js";
import { generate } from "./generate.js";

export interface BatchInput {
  prompt?: string;
  messages?: GenerateOptions<ZodLike>["messages"];
  systemPrompt?: string;
  temperature?: number;
  maxRetries?: number;
}

export interface BatchItemResult<T> {
  index: number;
  input: BatchInput;
  data?: T;
  usage?: UsageInfo;
  error?: Error;
  durationMs: number;
}

export interface BatchProgress {
  completed: number;
  total: number;
  succeeded: number;
  failed: number;
  currentIndex: number;
}

export interface BatchOptions<TSchema extends ZodLike>
  extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
  inputs: BatchInput[];
  concurrency?: number;
  continueOnError?: boolean;
  onProgress?: (progress: BatchProgress) => void;
}

export interface BatchResult<T> {
  items: BatchItemResult<T>[];
  succeeded: BatchItemResult<T>[];
  failed: BatchItemResult<T>[];
  totalUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    totalDurationMs: number;
  };
}

export async function generateBatch<TSchema extends ZodLike>(
  options: BatchOptions<TSchema>
): Promise<BatchResult<z.infer<TSchema>>> {
  const {
    inputs,
    concurrency = 3,
    continueOnError = true,
    onProgress,
    ...baseOptions
  } = options;

  const results: BatchItemResult<z.infer<TSchema>>[] = new Array(inputs.length);
  let completedCount = 0;
  let succeededCount = 0;
  let failedCount = 0;

  // Process in chunks of `concurrency`
  for (let i = 0; i < inputs.length; i += concurrency) {
    const chunk = inputs.slice(i, i + concurrency);

    await Promise.all(
      chunk.map(async (input, chunkIdx) => {
        const globalIdx = i + chunkIdx;
        const start = Date.now();

        try {
          const result = await generate({
            ...baseOptions,
            prompt: input.prompt,
            messages: input.messages,
            systemPrompt: input.systemPrompt ?? baseOptions.systemPrompt,
            temperature: input.temperature ?? baseOptions.temperature,
            maxRetries: input.maxRetries ?? baseOptions.maxRetries,
          } as GenerateOptions<TSchema>);

          results[globalIdx] = {
            index: globalIdx,
            input,
            data: result.data,
            usage: result.usage,
            durationMs: Date.now() - start,
          };
          succeededCount++;
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          results[globalIdx] = {
            index: globalIdx,
            input,
            error,
            durationMs: Date.now() - start,
          };
          failedCount++;
          if (!continueOnError) throw error;
        }

        completedCount++;
        onProgress?.({
          completed: completedCount,
          total: inputs.length,
          succeeded: succeededCount,
          failed: failedCount,
          currentIndex: globalIdx,
        });
      })
    );
  }

  const succeeded = results.filter((r) => !r.error);
  const failed = results.filter((r) => !!r.error);

  // Aggregate usage if available
  const usageItems = succeeded.filter((r) => r.usage);
  const totalUsage =
    usageItems.length > 0
      ? {
          promptTokens: usageItems.reduce((s, r) => s + (r.usage?.promptTokens ?? 0), 0),
          completionTokens: usageItems.reduce((s, r) => s + (r.usage?.completionTokens ?? 0), 0),
          totalTokens: usageItems.reduce((s, r) => s + (r.usage?.totalTokens ?? 0), 0),
          estimatedCostUsd: usageItems.reduce((s, r) => s + (r.usage?.estimatedCostUsd ?? 0), 0),
          totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
        }
      : undefined;

  return { items: results, succeeded, failed, totalUsage };
}
