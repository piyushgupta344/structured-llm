import { z } from 'zod';
import { Z as ZodLike, G as GenerateOptions, a as GenerateResult, b as GenerateArrayOptions, c as GenerateArrayResult, d as GenerateStreamOptions, S as StreamEvent, U as UsageInfo, C as CreateClientOptions, P as ProviderName, E as ExtractionMode, e as SchemaAdapter } from './types-BPvyU1tv.js';
export { F as FallbackEntry, H as Hooks, J as JSONSchema, M as Message, f as MessageRole, R as RetryOptions, g as RetryStrategy, h as StreamChunk, i as StreamFinal } from './types-BPvyU1tv.js';

declare function generate<TSchema extends ZodLike>(options: GenerateOptions<TSchema>): Promise<GenerateResult<z.infer<TSchema>>>;

declare function generateArray<TSchema extends ZodLike>(options: GenerateArrayOptions<TSchema>): Promise<GenerateArrayResult<z.infer<TSchema>>>;

declare function generateStream<TSchema extends ZodLike>(options: GenerateStreamOptions<TSchema>): AsyncIterable<StreamEvent<z.infer<TSchema>>> & {
    result: Promise<{
        data: z.infer<TSchema>;
        usage?: UsageInfo;
    }>;
};

interface BatchInput {
    prompt?: string;
    messages?: GenerateOptions<ZodLike>["messages"];
    systemPrompt?: string;
    temperature?: number;
    maxRetries?: number;
}
interface BatchItemResult<T> {
    index: number;
    input: BatchInput;
    data?: T;
    usage?: UsageInfo;
    error?: Error;
    durationMs: number;
}
interface BatchProgress {
    completed: number;
    total: number;
    succeeded: number;
    failed: number;
    currentIndex: number;
}
interface BatchOptions<TSchema extends ZodLike> extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
    inputs: BatchInput[];
    concurrency?: number;
    continueOnError?: boolean;
    onProgress?: (progress: BatchProgress) => void;
}
interface BatchResult<T> {
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
declare function generateBatch<TSchema extends ZodLike>(options: BatchOptions<TSchema>): Promise<BatchResult<z.infer<TSchema>>>;

type SchemaMap = Record<string, ZodLike>;
type MultiSchemaResult<M extends SchemaMap> = {
    [K in keyof M]: z.infer<M[K]>;
};
interface MultiSchemaItemResult<T> {
    data?: T;
    usage?: UsageInfo;
    error?: Error;
    durationMs: number;
}
interface MultiSchemaResults<M extends SchemaMap> {
    results: {
        [K in keyof M]: MultiSchemaItemResult<z.infer<M[K]>>;
    };
    totalUsage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        estimatedCostUsd: number;
    };
}
interface GenerateMultiSchemaOptions<M extends SchemaMap> extends Omit<GenerateOptions<ZodLike>, "schema"> {
    schemas: M;
    parallel?: boolean;
    continueOnError?: boolean;
}
declare function generateMultiSchema<M extends SchemaMap>(options: GenerateMultiSchemaOptions<M>): Promise<MultiSchemaResults<M>>;

type ClassifyOption = string | {
    value: string;
    description?: string;
};
interface ClassifyOptions extends Omit<GenerateOptions<ZodLike>, "schema" | "prompt" | "messages"> {
    prompt?: string;
    messages?: GenerateOptions<ZodLike>["messages"];
    options: ClassifyOption[];
    allowMultiple?: boolean;
    includeConfidence?: boolean;
    includeReasoning?: boolean;
}
interface ClassifyResult {
    label: string;
    labels: string[];
    confidence?: number;
    reasoning?: string;
}
declare function classify(opts: ClassifyOptions): Promise<ClassifyResult>;

type FieldType = "string" | "number" | "boolean" | "date" | "email" | "phone" | "url" | "integer";
interface FieldDef {
    type: FieldType;
    description?: string;
    required?: boolean;
    options?: string[];
}
type FieldSpec = FieldType | FieldDef;
type ExtractFields = Record<string, FieldSpec>;
type FieldToType<F extends FieldSpec> = F extends "number" | "integer" ? number : F extends "boolean" ? boolean : F extends {
    type: "number" | "integer";
} ? number : F extends {
    type: "boolean";
} ? boolean : F extends {
    options: infer O extends string[];
} ? O[number] : string;
type ExtractResult<F extends ExtractFields> = {
    [K in keyof F]?: FieldToType<F[K]>;
};
interface ExtractOptions<F extends ExtractFields> extends Omit<GenerateOptions<ZodLike>, "schema"> {
    fields: F;
    requireAll?: boolean;
}
declare function extract<F extends ExtractFields>(opts: ExtractOptions<F>): Promise<ExtractResult<F>>;

type BoundOmit = "client" | "provider" | "apiKey" | "baseURL";
interface StructuredLLMClient {
    generate<TSchema extends ZodLike>(options: Omit<GenerateOptions<TSchema>, BoundOmit>): Promise<GenerateResult<z.infer<TSchema>>>;
    generateArray<TSchema extends ZodLike>(options: Omit<GenerateArrayOptions<TSchema>, BoundOmit>): Promise<GenerateArrayResult<z.infer<TSchema>>>;
    generateStream<TSchema extends ZodLike>(options: Omit<GenerateStreamOptions<TSchema>, BoundOmit>): AsyncIterable<StreamEvent<z.infer<TSchema>>> & {
        result: Promise<{
            data: z.infer<TSchema>;
            usage?: UsageInfo;
        }>;
    };
    generateBatch<TSchema extends ZodLike>(options: Omit<BatchOptions<TSchema>, BoundOmit>): Promise<BatchResult<z.infer<TSchema>>>;
    classify(options: Omit<ClassifyOptions, BoundOmit>): Promise<ClassifyResult>;
    extract<F extends ExtractFields>(options: Omit<ExtractOptions<F>, BoundOmit>): Promise<ExtractResult<F>>;
    generateMultiSchema<M extends SchemaMap>(options: Omit<GenerateMultiSchemaOptions<M>, BoundOmit>): Promise<MultiSchemaResults<M>>;
}
declare function createClient(clientOptions: CreateClientOptions): StructuredLLMClient;

type TemplateVars = Record<string, string | number>;
interface TemplateConfig<TSchema extends ZodLike> extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
    template: string;
}
interface BoundTemplate<TSchema extends ZodLike> {
    run(vars: TemplateVars, overrides?: Partial<Omit<GenerateOptions<TSchema>, "prompt">>): Promise<GenerateResult<z.infer<TSchema>>>;
    runArray(vars: TemplateVars, overrides?: Partial<Omit<GenerateArrayOptions<TSchema>, "prompt">>): Promise<GenerateArrayResult<z.infer<TSchema>>>;
    render(vars: TemplateVars): string;
}
declare function createTemplate<TSchema extends ZodLike>(config: TemplateConfig<TSchema>): BoundTemplate<TSchema>;

interface CacheEntry<T> {
    data: T;
    usage: GenerateResult<T>["usage"];
    cachedAt: number;
    expiresAt: number;
}
interface CacheStore {
    get(key: string): CacheEntry<unknown> | undefined;
    set(key: string, entry: CacheEntry<unknown>): void;
    delete(key: string): void;
    clear(): void;
    size(): number;
}
interface WithCacheOptions {
    ttl?: number;
    store?: CacheStore;
    keyFn?: (opts: {
        prompt?: string;
        messages?: unknown[];
        model: string;
    }) => string;
    debug?: boolean;
}
interface CachedGenerateResult<T> extends GenerateResult<T> {
    fromCache: boolean;
    cachedAt?: number;
}
declare function createMemoryStore(): CacheStore;
declare function withCache(cacheOpts?: WithCacheOptions): <TSchema extends ZodLike>(opts: GenerateOptions<TSchema>) => Promise<CachedGenerateResult<z.infer<TSchema>>>;

declare class StructuredLLMError extends Error {
    constructor(message: string);
}
declare class ValidationError extends StructuredLLMError {
    issues: unknown[];
    lastResponse: string;
    attempts: number;
    constructor(issues: unknown[], lastResponse: string, attempts: number);
}
declare class ParseError extends StructuredLLMError {
    lastResponse: string;
    attempts: number;
    constructor(lastResponse: string, attempts: number);
}
declare class ProviderError extends StructuredLLMError {
    provider: string;
    statusCode?: number;
    originalError: unknown;
    constructor(provider: string, message: string, statusCode?: number, originalError?: unknown);
}
declare class MaxRetriesError extends StructuredLLMError {
    attempts: number;
    lastError: string;
    constructor(attempts: number, lastError: string);
}
declare class SchemaError extends StructuredLLMError {
    constructor(message: string);
}
declare class UnsupportedProviderError extends StructuredLLMError {
    constructor(provider: string);
}
declare class MissingInputError extends StructuredLLMError {
    constructor();
}

interface ModelCapabilities {
    provider: ProviderName;
    toolCalling: boolean;
    jsonMode: boolean;
    streaming: boolean;
    contextWindow: number;
    inputCostPer1M?: number;
    outputCostPer1M?: number;
}
declare function getModelCapabilities(model: string): ModelCapabilities | undefined;
declare function listSupportedModels(filter?: {
    provider?: ProviderName;
}): string[];
declare function resolveMode(model: string, preferred?: string): ExtractionMode;

interface CustomSchema<T = unknown> {
    jsonSchema: Record<string, unknown>;
    parse: (data: unknown) => T;
    safeParse?: (data: unknown) => {
        success: true;
        data: T;
    } | {
        success: false;
        error: string;
    };
}
declare function resolveSchema<T>(schema: unknown): SchemaAdapter<T>;

export { type BatchInput, type BatchItemResult, type BatchOptions, type BatchProgress, type BatchResult, type BoundTemplate, type CacheEntry, type CacheStore, type CachedGenerateResult, type ClassifyOption, type ClassifyOptions, type ClassifyResult, CreateClientOptions, type CustomSchema, type ExtractFields, type ExtractOptions, type ExtractResult, ExtractionMode, type FieldDef, type FieldSpec, type FieldType, GenerateArrayOptions, GenerateArrayResult, type GenerateMultiSchemaOptions, GenerateOptions, GenerateResult, GenerateStreamOptions, MaxRetriesError, MissingInputError, type MultiSchemaItemResult, type MultiSchemaResult, type MultiSchemaResults, ParseError, ProviderError, ProviderName, SchemaAdapter, SchemaError, type SchemaMap, StreamEvent, type StructuredLLMClient, StructuredLLMError, type TemplateConfig, type TemplateVars, UnsupportedProviderError, UsageInfo, ValidationError, type WithCacheOptions, ZodLike, classify, createMemoryStore as createCacheStore, createClient, createTemplate, extract, generate, generateArray, generateBatch, generateMultiSchema, generateStream, getModelCapabilities, listSupportedModels, resolveMode, resolveSchema, withCache };
