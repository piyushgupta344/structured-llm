import type { Hooks, Message, ProviderName, UsageInfo } from "./types.js";

export async function runHook<K extends keyof Hooks>(
  hooks: Hooks | undefined,
  event: K,
  ctx: Parameters<NonNullable<Hooks[K]>>[0]
) {
  if (!hooks) return;
  const fn = hooks[event] as ((ctx: typeof ctx) => void | Promise<void>) | undefined;
  if (fn) await fn(ctx);
}

export async function emitRequest(
  hooks: Hooks | undefined,
  messages: Message[],
  model: string,
  provider: ProviderName,
  attempt: number
) {
  await runHook(hooks, "onRequest", { messages, model, provider, attempt });
}

export async function emitResponse(
  hooks: Hooks | undefined,
  rawResponse: string,
  attempt: number,
  model: string
) {
  await runHook(hooks, "onResponse", { rawResponse, attempt, model });
}

export async function emitRetry(
  hooks: Hooks | undefined,
  attempt: number,
  maxRetries: number,
  error: string,
  model: string
) {
  await runHook(hooks, "onRetry", { attempt, maxRetries, error, model });
}

export async function emitSuccess<T>(
  hooks: Hooks<T> | undefined,
  result: T,
  usage?: UsageInfo
) {
  await runHook(hooks as Hooks, "onSuccess", { result, usage });
}

export async function emitError(
  hooks: Hooks | undefined,
  error: Error,
  allAttempts: number
) {
  await runHook(hooks, "onError", { error, allAttempts });
}
