/**
 * Example: Sentiment analysis with scoring
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/01-sentiment-analysis.ts
 */

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const SentimentSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(-1).max(1).describe("Score from -1 (very negative) to 1 (very positive)"),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().describe("One sentence explaining the classification"),
  keywords: z.array(z.string()).describe("Key words that drove the classification"),
});

const reviews = [
  "This product completely exceeded my expectations! Best purchase I've made all year.",
  "Total waste of money. Broke after 2 days and customer support was useless.",
  "It's okay I guess. Does what it says, nothing special.",
  "I have mixed feelings — the design is beautiful but the performance is terrible.",
];

const openai = new OpenAI();

async function analyzeReviews() {
  console.log("Analyzing reviews...\n");

  for (const review of reviews) {
    const { data, usage } = await generate({
      client: openai,
      model: "gpt-4o-mini",
      schema: SentimentSchema,
      prompt: `Analyze the sentiment of this product review:\n\n"${review}"`,
      systemPrompt: "You are a sentiment analysis expert. Be precise and consistent.",
      trackUsage: true,
      hooks: {
        onRetry: ({ attempt, error }) => {
          console.warn(`  Retry ${attempt}: ${error}`);
        },
      },
    });

    console.log(`Review: "${review.slice(0, 60)}..."`);
    console.log(`  Sentiment: ${data.sentiment} (score: ${data.score.toFixed(2)}, confidence: ${(data.confidence * 100).toFixed(0)}%)`);
    console.log(`  Reasoning: ${data.reasoning}`);
    console.log(`  Keywords: ${data.keywords.join(", ")}`);
    console.log(`  Cost: $${usage?.estimatedCostUsd?.toFixed(6)}\n`);
  }
}

analyzeReviews().catch(console.error);
