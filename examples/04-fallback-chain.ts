/**
 * Example: Fallback chain — primary provider fails, auto-falls back
 *
 * Useful for: cost optimization, uptime, rate limit handling
 *
 * Run: OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/04-fallback-chain.ts
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { generate } from "../src/index.js";

const ClassificationSchema = z.object({
  category: z.enum([
    "technology",
    "finance",
    "health",
    "sports",
    "politics",
    "entertainment",
    "science",
    "other",
  ]),
  subcategory: z.string(),
  confidence: z.number().min(0).max(1),
  tags: z.array(z.string()),
});

const headlines = [
  "Federal Reserve raises interest rates by 25 basis points amid inflation concerns",
  "New CRISPR technique successfully reverses genetic disorder in clinical trial",
  "Tech giants report mixed earnings as AI investment continues to surge",
  "Championship final draws record 50 million viewers worldwide",
];

async function classifyWithFallback() {
  const openai = new OpenAI();
  const anthropic = new Anthropic();

  // Groq as a cheap/fast third option
  const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY ?? "dummy",
    baseURL: "https://api.groq.com/openai/v1",
  });

  for (const headline of headlines) {
    console.log(`\nClassifying: "${headline}"`);

    const { data } = await generate({
      // primary: GPT-4o-mini
      client: openai,
      model: "gpt-4o-mini",

      // fallbacks tried in order if primary fails
      fallbackChain: [
        { client: anthropic, model: "claude-haiku-4-5" },
        { client: groq, model: "llama-3.1-8b-instant" },
      ],

      schema: ClassificationSchema,
      prompt: `Classify this news headline:\n\n"${headline}"`,
      hooks: {
        onError: ({ error }) => {
          console.log(`  Primary failed (${error.message}), trying fallback...`);
        },
      },
    });

    console.log(`  Category: ${data.category} > ${data.subcategory}`);
    console.log(`  Confidence: ${(data.confidence * 100).toFixed(0)}%`);
    console.log(`  Tags: ${data.tags.join(", ")}`);
  }
}

classifyWithFallback().catch(console.error);
