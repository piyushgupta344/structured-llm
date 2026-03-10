import { z } from 'zod';

type MessageRole = "system" | "user" | "assistant";
interface Message {
    role: MessageRole;
    content: string;
}
type ExtractionMode = "tool-calling" | "json-mode" | "prompt-inject" | "auto";
type ProviderName = "openai" | "anthropic" | "gemini" | "mistral" | "groq" | "azure-openai" | "xai" | "together" | "fireworks" | "perplexity" | "ollama" | "cohere" | "bedrock";
type RetryStrategy = "immediate" | "linear" | "exponential";
interface RetryOptions {
    maxRetries?: number;
    strategy?: RetryStrategy;
    baseDelayMs?: number;
}
interface UsageInfo {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    estimatedCostUsd?: number;
    latencyMs: number;
    attempts: number;
    model: string;
    provider: ProviderName;
}
interface Hooks<T = unknown> {
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
    onSuccess?: (ctx: {
        result: T;
        usage?: UsageInfo;
    }) => void | Promise<void>;
    onError?: (ctx: {
        error: Error;
        allAttempts: number;
    }) => void | Promise<void>;
}
interface FallbackEntry {
    client?: any;
    provider?: ProviderName;
    model: string;
    apiKey?: string;
    baseURL?: string;
}
interface JSONSchema {
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
interface SchemaAdapter<T = unknown> {
    jsonSchema: JSONSchema;
    parse: (data: unknown) => T;
    safeParse: (data: unknown) => {
        success: true;
        data: T;
    } | {
        success: false;
        error: string;
    };
}
type ZodLike = z.ZodType;
interface GenerateOptions<TSchema extends ZodLike> {
    client?: any;
    provider?: ProviderName;
    apiKey?: string;
    baseURL?: string;
    fallbackChain?: FallbackEntry[];
    model: string;
    schema: TSchema;
    prompt?: string;
    messages?: Message[];
    systemPrompt?: string;
    mode?: ExtractionMode;
    maxRetries?: number;
    retryOptions?: RetryOptions;
    temperature?: number;
    maxTokens?: number;
    trackUsage?: boolean;
    hooks?: Hooks<z.infer<TSchema>>;
}
interface GenerateArrayOptions<TSchema extends ZodLike> extends Omit<GenerateOptions<TSchema>, "schema"> {
    schema: TSchema;
    minItems?: number;
    maxItems?: number;
}
interface GenerateStreamOptions<TSchema extends ZodLike> extends GenerateOptions<TSchema> {
}
interface GenerateResult<T> {
    data: T;
    usage?: UsageInfo;
}
interface GenerateArrayResult<T> {
    data: T[];
    usage?: UsageInfo;
}
interface StreamChunk<T> {
    partial: Partial<T>;
    isDone: false;
}
interface StreamFinal<T> {
    partial: T;
    isDone: true;
    usage?: UsageInfo;
}
type StreamEvent<T> = StreamChunk<T> | StreamFinal<T>;
interface CreateClientOptions {
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
        systemPrompt?: string;
        trackUsage?: boolean;
        hooks?: Hooks;
        retryOptions?: RetryOptions;
    };
}

export type { CreateClientOptions as C, ExtractionMode as E, FallbackEntry as F, GenerateOptions as G, Hooks as H, JSONSchema as J, Message as M, ProviderName as P, RetryOptions as R, StreamEvent as S, UsageInfo as U, ZodLike as Z, GenerateResult as a, GenerateArrayOptions as b, GenerateArrayResult as c, GenerateStreamOptions as d, SchemaAdapter as e, MessageRole as f, RetryStrategy as g, StreamChunk as h, StreamFinal as i };
