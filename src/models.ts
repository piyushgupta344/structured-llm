import type { ExtractionMode, ProviderName } from "./types.js";

export interface ModelCapabilities {
  provider: ProviderName;
  toolCalling: boolean;
  jsonMode: boolean;
  strictJsonSchema: boolean; // supports response_format: { type: "json_schema", strict: true }
  streaming: boolean;
  contextWindow: number;
  // cost per 1M tokens in USD
  inputCostPer1M?: number;
  outputCostPer1M?: number;
}

// Snapshot of known models + capabilities. PR-welcome to keep this up to date.
const MODEL_REGISTRY: Record<string, ModelCapabilities> = {
  // OpenAI — strictJsonSchema: true for models that support response_format: json_schema + strict: true
  // (requires gpt-4o-2024-08-06 or later, gpt-4o-mini-2024-07-18 or later, gpt-4.1 family, o3/o4 family)
  "gpt-4.1":      { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: true,  streaming: true,  contextWindow: 1047576, inputCostPer1M: 2,    outputCostPer1M: 8 },
  "gpt-4.1-mini": { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: true,  streaming: true,  contextWindow: 1047576, inputCostPer1M: 0.4,  outputCostPer1M: 1.6 },
  "gpt-4.1-nano": { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: true,  streaming: true,  contextWindow: 1047576, inputCostPer1M: 0.1,  outputCostPer1M: 0.4 },
  "gpt-4o":       { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: true,  streaming: true,  contextWindow: 128000,  inputCostPer1M: 2.5,  outputCostPer1M: 10 },
  "gpt-4o-mini":  { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: true,  streaming: true,  contextWindow: 128000,  inputCostPer1M: 0.15, outputCostPer1M: 0.6 },
  "gpt-4-turbo":  { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true,  contextWindow: 128000,  inputCostPer1M: 10,   outputCostPer1M: 30 },
  "gpt-4":        { provider: "openai", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true,  contextWindow: 8192,    inputCostPer1M: 30,   outputCostPer1M: 60 },
  "gpt-3.5-turbo":{ provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true,  contextWindow: 16385,   inputCostPer1M: 0.5,  outputCostPer1M: 1.5 },
  "o1":           { provider: "openai", toolCalling: false, jsonMode: false, strictJsonSchema: false, streaming: false, contextWindow: 200000,  inputCostPer1M: 15,   outputCostPer1M: 60 },
  "o1-mini":      { provider: "openai", toolCalling: false, jsonMode: false, strictJsonSchema: false, streaming: false, contextWindow: 128000,  inputCostPer1M: 3,    outputCostPer1M: 12 },
  "o3":           { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: true,  streaming: true,  contextWindow: 200000,  inputCostPer1M: 10,   outputCostPer1M: 40 },
  "o3-mini":      { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: true,  streaming: true,  contextWindow: 200000,  inputCostPer1M: 1.1,  outputCostPer1M: 4.4 },
  "o4-mini":      { provider: "openai", toolCalling: true, jsonMode: true, strictJsonSchema: true,  streaming: true,  contextWindow: 200000,  inputCostPer1M: 1.1,  outputCostPer1M: 4.4 },

  // Anthropic
  "claude-opus-4-6":          { provider: "anthropic", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true, contextWindow: 200000, inputCostPer1M: 15,  outputCostPer1M: 75 },
  "claude-sonnet-4-6":        { provider: "anthropic", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true, contextWindow: 200000, inputCostPer1M: 3,   outputCostPer1M: 15 },
  "claude-haiku-4-5":         { provider: "anthropic", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true, contextWindow: 200000, inputCostPer1M: 0.8, outputCostPer1M: 4 },
  "claude-haiku-4-5-20251001":{ provider: "anthropic", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true, contextWindow: 200000, inputCostPer1M: 0.8, outputCostPer1M: 4 },
  "claude-3-7-sonnet-20250219":{ provider: "anthropic", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true, contextWindow: 200000, inputCostPer1M: 3,  outputCostPer1M: 15 },
  "claude-3-5-sonnet-20241022":{ provider: "anthropic", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true, contextWindow: 200000, inputCostPer1M: 3,  outputCostPer1M: 15 },
  "claude-3-5-haiku-20241022": { provider: "anthropic", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true, contextWindow: 200000, inputCostPer1M: 0.8, outputCostPer1M: 4 },
  "claude-3-opus-20240229":    { provider: "anthropic", toolCalling: true, jsonMode: false, strictJsonSchema: false, streaming: true, contextWindow: 200000, inputCostPer1M: 15,  outputCostPer1M: 75 },

  // Gemini
  "gemini-2.5-pro":       { provider: "gemini", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 1048576, inputCostPer1M: 1.25,  outputCostPer1M: 10 },
  "gemini-2.5-flash":     { provider: "gemini", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 1048576, inputCostPer1M: 0.15,  outputCostPer1M: 0.6 },
  "gemini-2.0-flash":     { provider: "gemini", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 1048576, inputCostPer1M: 0.1,   outputCostPer1M: 0.4 },
  "gemini-2.0-flash-lite":{ provider: "gemini", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 1048576, inputCostPer1M: 0.075, outputCostPer1M: 0.3 },
  "gemini-1.5-pro":       { provider: "gemini", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 2097152, inputCostPer1M: 1.25,  outputCostPer1M: 5 },
  "gemini-1.5-flash":     { provider: "gemini", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 1048576, inputCostPer1M: 0.075, outputCostPer1M: 0.3 },

  // Mistral
  "mistral-large-latest": { provider: "mistral", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 2,   outputCostPer1M: 6 },
  "mistral-small-latest": { provider: "mistral", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 0.2, outputCostPer1M: 0.6 },
  "mistral-nemo":         { provider: "mistral", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 0.15, outputCostPer1M: 0.15 },
  "codestral-latest":     { provider: "mistral", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 256000, inputCostPer1M: 0.3,  outputCostPer1M: 0.9 },

  // Groq (fast inference)
  "llama-4-scout-17b-16e-instruct":    { provider: "groq", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 0.11, outputCostPer1M: 0.34 },
  "llama-4-maverick-17b-128e-instruct":{ provider: "groq", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 0.2,  outputCostPer1M: 0.6 },
  "llama-3.3-70b-versatile":           { provider: "groq", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 128000, inputCostPer1M: 0.59, outputCostPer1M: 0.79 },
  "llama-3.1-8b-instant":              { provider: "groq", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 128000, inputCostPer1M: 0.05, outputCostPer1M: 0.08 },
  "mixtral-8x7b-32768":                { provider: "groq", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 32768,  inputCostPer1M: 0.24, outputCostPer1M: 0.24 },
  "gemma2-9b-it":                      { provider: "groq", toolCalling: false, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 8192,   inputCostPer1M: 0.2,  outputCostPer1M: 0.2 },

  // xAI
  "grok-beta": { provider: "xai", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 5, outputCostPer1M: 15 },
  "grok-2":    { provider: "xai", toolCalling: true, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 2, outputCostPer1M: 10 },

  // Together AI (open models)
  "meta-llama/Llama-3.3-70B-Instruct-Turbo":    { provider: "together", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 0.88, outputCostPer1M: 0.88 },
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo":{ provider: "together", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 0.18, outputCostPer1M: 0.18 },
  "mistralai/Mixtral-8x7B-Instruct-v0.1":        { provider: "together", toolCalling: false, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 32768,  inputCostPer1M: 0.6,  outputCostPer1M: 0.6 },
  "Qwen/Qwen2.5-72B-Instruct-Turbo":             { provider: "together", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 32768,  inputCostPer1M: 1.2,  outputCostPer1M: 1.2 },

  // Ollama (local — costs are $0)
  "llama3.2": { provider: "ollama", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 128000, inputCostPer1M: 0, outputCostPer1M: 0 },
  "llama3.1": { provider: "ollama", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 128000, inputCostPer1M: 0, outputCostPer1M: 0 },
  "mistral":  { provider: "ollama", toolCalling: false, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 32768,  inputCostPer1M: 0, outputCostPer1M: 0 },
  "qwen2.5":  { provider: "ollama", toolCalling: true,  jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 131072, inputCostPer1M: 0, outputCostPer1M: 0 },
  "phi4":     { provider: "ollama", toolCalling: false, jsonMode: true, strictJsonSchema: false, streaming: true, contextWindow: 16384,  inputCostPer1M: 0, outputCostPer1M: 0 },
};

export function getModelCapabilities(model: string): ModelCapabilities | undefined {
  return MODEL_REGISTRY[model];
}

export function listSupportedModels(filter?: { provider?: ProviderName }): string[] {
  if (!filter?.provider) return Object.keys(MODEL_REGISTRY);
  return Object.entries(MODEL_REGISTRY)
    .filter(([, caps]) => caps.provider === filter.provider)
    .map(([model]) => model);
}

// Best extraction mode for a given model, respecting user override
export function resolveMode(model: string, preferred?: string): ExtractionMode {
  if (preferred && preferred !== "auto") return preferred as ExtractionMode;

  const caps = MODEL_REGISTRY[model];
  if (!caps) {
    // unknown model — try tool-calling first (most providers support it these days)
    return "tool-calling";
  }

  if (caps.strictJsonSchema) return "json-schema";
  if (caps.toolCalling) return "tool-calling";
  if (caps.jsonMode) return "json-mode";
  return "prompt-inject";
}
