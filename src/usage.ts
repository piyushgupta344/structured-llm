import type { ProviderName, UsageInfo } from "./types.js";
import { getModelCapabilities } from "./models.js";

export function calcCost(model: string, promptTokens: number, completionTokens: number): number {
  const caps = getModelCapabilities(model);
  if (!caps || !caps.inputCostPer1M || !caps.outputCostPer1M) return 0;
  return (
    (promptTokens / 1_000_000) * caps.inputCostPer1M +
    (completionTokens / 1_000_000) * caps.outputCostPer1M
  );
}

export function buildUsage(
  model: string,
  provider: ProviderName,
  promptTokens: number,
  completionTokens: number,
  startTime: number,
  attempts: number
): UsageInfo {
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCostUsd: calcCost(model, promptTokens, completionTokens),
    latencyMs: Date.now() - startTime,
    attempts,
    model,
    provider,
  };
}

// Rough token estimator for when the provider doesn't return usage
// (4 chars ≈ 1 token — not exact but good enough for logging)
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
