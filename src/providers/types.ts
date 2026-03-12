import type { ExtractionMode, JSONSchema, Message, ProviderName } from "../types.js";

export interface AdapterRequest {
  model: string;
  messages: Message[];
  schema: JSONSchema;
  schemaName: string;
  mode: ExtractionMode;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  seed?: number;
  signal?: AbortSignal;
}

export interface AdapterResponse {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ProviderAdapter {
  readonly name: ProviderName;
  complete(req: AdapterRequest): Promise<AdapterResponse>;
  stream?(req: AdapterRequest): AsyncIterable<string>;
}
