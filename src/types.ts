import type { z } from "zod";

export type MessageRole = "system" | "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export type ExtractionMode = "tool-calling" | "json-mode" | "prompt-inject" | "auto";

export type ProviderName =
  | "openai"
  | "anthropic"
  | "gemini"
  | "mistral"
  | "groq"
  | "azure-openai"
  | "xai"
  | "together"
  | "fireworks"
  | "perplexity"
  | "ollama"
  | "cohere"
  | "bedrock";

export type RetryStrategy = "immediate" | "linear" | "exponential";

export interface RetryOptions {
  maxRetries?: number;
  strategy?: RetryStrategy;
  baseDelayMs?: number;
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number;
  latencyMs: number;
  attempts: number;
  model: string;
  provider: ProviderName;
}

export interface Hooks<T = unknown> {
  onRequest?: (ctx: {
    messages: Message[];
    model: string;
    provider: ProviderName;
    attempt: number;
  }) => void | Promise<void>;
  onResponse?: (ctx: {
    rawResponse: string;
    attempt: number;
    model: string;
  }) => void | Promise<void>;
  onRetry?: (ctx: {
    attempt: number;
    maxRetries: number;
    error: string;
    model: string;
  }) => void | Promise<void>;
  onSuccess?: (ctx: { result: T; usage?: UsageInfo }) => void | Promise<void>;
  onError?: (ctx: { error: Error; allAttempts: number }) => void | Promise<void>;
  onChunk?: (ctx: { partial: Partial<T>; model: string }) => void | Promise<void>;
}

export interface FallbackEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
  provider?: ProviderName;
  model: string;
  apiKey?: string;
  baseURL?: string;
}

export interface JSONSchema {
  type?: string | string[];
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: unknown[];
  const?: unknown;
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  description?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  additionalProperties?: boolean | JSONSchema;
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  [key: string]: unknown;
}

export interface SchemaAdapter<T = unknown> {
  jsonSchema: JSONSchema;
  parse: (data: unknown) => T;
  safeParse: (data: unknown) => { success: true; data: T } | { success: false; error: string };
}

export type ZodLike = z.ZodType;

export interface GenerateOptions<TSchema extends ZodLike> {
  // pass an existing openai/anthropic/etc client, or use provider + apiKey
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
  provider?: ProviderName;
  apiKey?: string;
  baseURL?: string;
  fallbackChain?: FallbackEntry[];

  model: string;
  schema: TSchema;

  // one of prompt or messages is required
  prompt?: string;
  messages?: Message[];
  systemPrompt?: string;

  mode?: ExtractionMode;
  maxRetries?: number;
  retryOptions?: RetryOptions;

  temperature?: number;
  maxTokens?: number;
  topP?: number;
  seed?: number;

  signal?: AbortSignal;
  trackUsage?: boolean;
  hooks?: Hooks<z.infer<TSchema>>;
}

export interface GenerateArrayOptions<TSchema extends ZodLike>
  extends Omit<GenerateOptions<TSchema>, "schema"> {
  schema: TSchema;
  minItems?: number;
  maxItems?: number;
}

export interface GenerateStreamOptions<TSchema extends ZodLike>
  extends GenerateOptions<TSchema> {}

export interface GenerateResult<T> {
  data: T;
  usage?: UsageInfo;
}

export interface GenerateArrayResult<T> {
  data: T[];
  usage?: UsageInfo;
}

export interface StreamChunk<T> {
  partial: Partial<T>;
  isDone: false;
}

export interface StreamFinal<T> {
  partial: T;
  isDone: true;
  usage?: UsageInfo;
}

export type StreamEvent<T> = StreamChunk<T> | StreamFinal<T>;

export interface CreateClientOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client?: any;
  provider?: ProviderName;
  apiKey?: string;
  baseURL?: string;
  model?: string;
  defaultOptions?: {
    mode?: ExtractionMode;
    maxRetries?: number;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    seed?: number;
    systemPrompt?: string;
    trackUsage?: boolean;
    hooks?: Hooks;
    retryOptions?: RetryOptions;
  };
}
