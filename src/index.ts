// Core functions
export { generate } from "./generate.js";
export { generateArray } from "./generate-array.js";
export { generateStream } from "./generate-stream.js";
export { generateBatch } from "./generate-batch.js";
export { generateMultiSchema } from "./generate-multi-schema.js";
export { createClient } from "./client.js";

// High-level helpers
export { classify } from "./classify.js";
export { extract } from "./extract.js";
export { createTemplate } from "./template.js";
export { withCache, createCacheStore } from "./cache.js";

// Types
export type {
  Message,
  MessageRole,
  ExtractionMode,
  ProviderName,
  RetryOptions,
  RetryStrategy,
  UsageInfo,
  Hooks,
  FallbackEntry,
  JSONSchema,
  SchemaAdapter,
  ZodLike,
  GenerateOptions,
  GenerateArrayOptions,
  GenerateStreamOptions,
  GenerateResult,
  GenerateArrayResult,
  StreamEvent,
  StreamChunk,
  StreamFinal,
  CreateClientOptions,
} from "./types.js";

export type {
  BatchInput,
  BatchItemResult,
  BatchProgress,
  BatchOptions,
  BatchResult,
} from "./generate-batch.js";

export type {
  ClassifyOption,
  ClassifyOptions,
  ClassifyResult,
} from "./classify.js";

export type {
  FieldType,
  FieldDef,
  FieldSpec,
  ExtractFields,
  ExtractOptions,
  ExtractResult,
} from "./extract.js";

export type {
  TemplateVars,
  TemplateConfig,
  BoundTemplate,
} from "./template.js";

export type {
  CacheEntry,
  CacheStore,
  WithCacheOptions,
  CachedGenerateResult,
} from "./cache.js";

export type {
  SchemaMap,
  MultiSchemaResult,
  MultiSchemaItemResult,
  MultiSchemaResults,
  GenerateMultiSchemaOptions,
} from "./generate-multi-schema.js";

// Errors
export {
  StructuredLLMError,
  ValidationError,
  ParseError,
  ProviderError,
  MaxRetriesError,
  SchemaError,
  UnsupportedProviderError,
  MissingInputError,
} from "./errors.js";

// Model utilities
export { getModelCapabilities, listSupportedModels, resolveMode } from "./models.js";

// Schema utilities
export { resolveSchema } from "./schema/detect.js";
export type { CustomSchema } from "./schema/detect.js";

// createClient type
export type { StructuredLLMClient } from "./client.js";
