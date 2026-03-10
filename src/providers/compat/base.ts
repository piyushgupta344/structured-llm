// OpenAI-compatible providers — just point to a different baseURL
import { OpenAIAdapter } from "../openai.js";
import type { ProviderName } from "../../types.js";

// These providers all speak OpenAI's API format.
// We create their client at runtime using the openai SDK.
export async function createCompatClient(
  apiKey: string,
  baseURL: string,
  providerName: ProviderName
): Promise<OpenAIAdapter> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, baseURL });
  return new OpenAIAdapter(client, providerName);
}

// Check if a client is already an OpenAI-compat client for a given provider
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isCompatClient(client: any, baseURLPattern: string): boolean {
  const baseURL: string = client?.baseURL ?? client?._options?.baseURL ?? "";
  return baseURL.includes(baseURLPattern);
}
