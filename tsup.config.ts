import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "integrations/next/index": "integrations/next/index.ts",
    "integrations/hono/index": "integrations/hono/index.ts",
    "integrations/express/index": "integrations/express/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: [
    "zod",
    "openai",
    "@anthropic-ai/sdk",
    "@google/genai",
    "@mistralai/mistralai",
    "cohere-ai",
    "@aws-sdk/client-bedrock-runtime",
    "next",
    "hono",
    "express",
  ],
});
