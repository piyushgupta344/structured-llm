import type { ProviderAdapter } from "./types.js";
import type { FallbackEntry, ProviderName } from "../types.js";
import { OpenAIAdapter, isOpenAIClient } from "./openai.js";
import { AnthropicAdapter, isAnthropicClient } from "./anthropic.js";
import { GeminiAdapter, isGeminiClient } from "./gemini.js";
import { MistralAdapter, isMistralClient } from "./mistral.js";
import { CohereAdapter, isCohereClient } from "./cohere.js";
import { UnsupportedProviderError } from "../errors.js";

// OpenAI-compat provider base URLs
const COMPAT_URLS: Record<string, ProviderName> = {
  "api.groq.com": "groq",
  "api.x.ai": "xai",
  "api.together.xyz": "together",
  "api.fireworks.ai": "fireworks",
  "api.perplexity.ai": "perplexity",
  "localhost": "ollama",
  "127.0.0.1": "ollama",
  "openai.azure.com": "azure-openai",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectCompatProvider(client: any): ProviderName | null {
  const baseURL: string = client?.baseURL ?? client?._options?.baseURL ?? "";
  for (const [pattern, name] of Object.entries(COMPAT_URLS)) {
    if (baseURL.includes(pattern)) return name;
  }
  return null;
}

// Resolve a ProviderAdapter from a client instance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function adapterFromClient(client: any): ProviderAdapter {
  if (isAnthropicClient(client)) return new AnthropicAdapter(client);
  if (isGeminiClient(client)) return new GeminiAdapter(client);
  if (isMistralClient(client)) return new MistralAdapter(client);
  if (isCohereClient(client)) return new CohereAdapter(client);

  if (isOpenAIClient(client)) {
    const compatName = detectCompatProvider(client);
    return new OpenAIAdapter(client, compatName ?? "openai");
  }

  throw new UnsupportedProviderError("unknown — could not detect provider from client");
}

// Create a fresh adapter from provider name + apiKey (no existing client)
export async function adapterFromProvider(
  provider: ProviderName,
  apiKey?: string,
  baseURL?: string
): Promise<ProviderAdapter> {
  const key = apiKey ?? getEnvKey(provider);

  switch (provider) {
    case "openai": {
      const { default: OpenAI } = await import("openai");
      return new OpenAIAdapter(new OpenAI({ apiKey: key, baseURL }), "openai");
    }
    case "anthropic": {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      return new AnthropicAdapter(new Anthropic({ apiKey: key }));
    }
    case "gemini": {
      const { GoogleGenAI } = await import("@google/genai");
      return new GeminiAdapter(new GoogleGenAI({ apiKey: key }));
    }
    case "mistral": {
      const { Mistral } = await import("@mistralai/mistralai");
      return new MistralAdapter(new Mistral({ apiKey: key }));
    }
    case "groq": {
      const { default: OpenAI } = await import("openai");
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL: baseURL ?? "https://api.groq.com/openai/v1" }),
        "groq"
      );
    }
    case "xai": {
      const { default: OpenAI } = await import("openai");
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL: baseURL ?? "https://api.x.ai/v1" }),
        "xai"
      );
    }
    case "together": {
      const { default: OpenAI } = await import("openai");
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL: baseURL ?? "https://api.together.xyz/v1" }),
        "together"
      );
    }
    case "fireworks": {
      const { default: OpenAI } = await import("openai");
      return new OpenAIAdapter(
        new OpenAI({
          apiKey: key,
          baseURL: baseURL ?? "https://api.fireworks.ai/inference/v1",
        }),
        "fireworks"
      );
    }
    case "perplexity": {
      const { default: OpenAI } = await import("openai");
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL: baseURL ?? "https://api.perplexity.ai" }),
        "perplexity"
      );
    }
    case "ollama": {
      const { default: OpenAI } = await import("openai");
      return new OpenAIAdapter(
        new OpenAI({ apiKey: "ollama", baseURL: baseURL ?? "http://localhost:11434/v1" }),
        "ollama"
      );
    }
    case "azure-openai": {
      const { default: OpenAI } = await import("openai");
      if (!baseURL) throw new Error("azure-openai requires baseURL (your Azure endpoint)");
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL }),
        "azure-openai"
      );
    }
    case "cohere": {
      const { CohereClient } = await import("cohere-ai");
      return new CohereAdapter(new CohereClient({ token: key }));
    }
    default:
      throw new UnsupportedProviderError(provider);
  }
}

// Resolve an adapter from a FallbackEntry
export async function adapterFromEntry(entry: FallbackEntry): Promise<ProviderAdapter> {
  if (entry.client) return adapterFromClient(entry.client);
  if (entry.provider) {
    return adapterFromProvider(entry.provider, entry.apiKey, entry.baseURL);
  }
  throw new UnsupportedProviderError("FallbackEntry must have client or provider");
}

function getEnvKey(provider: ProviderName): string | undefined {
  const envMap: Record<ProviderName, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
    mistral: "MISTRAL_API_KEY",
    groq: "GROQ_API_KEY",
    "azure-openai": "AZURE_OPENAI_API_KEY",
    xai: "XAI_API_KEY",
    together: "TOGETHER_API_KEY",
    fireworks: "FIREWORKS_API_KEY",
    perplexity: "PERPLEXITY_API_KEY",
    ollama: "",
    cohere: "COHERE_API_KEY",
    bedrock: "AWS_ACCESS_KEY_ID",
  };
  const envVar = envMap[provider];
  return envVar ? process.env[envVar] : undefined;
}
