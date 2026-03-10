/**
 * Example: Same extraction across multiple providers
 *
 * Shows how you swap providers with zero code changes — just change the client.
 *
 * Run: OPENAI_API_KEY=sk-... ANTHROPIC_API_KEY=sk-ant-... npx tsx examples/03-multi-provider.ts
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { generate } from "../src/index.js";

const RecipeSchema = z.object({
  name: z.string(),
  cuisine: z.string(),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prepTimeMinutes: z.number().int(),
  cookTimeMinutes: z.number().int(),
  servings: z.number().int(),
  ingredients: z.array(
    z.object({
      item: z.string(),
      amount: z.string(),
      notes: z.string().optional(),
    })
  ),
  steps: z.array(z.string()),
  tips: z.array(z.string()).optional(),
});

const prompt = `
Create a recipe for a classic French onion soup. Include all ingredients with amounts and clear step-by-step instructions.
`;

async function compareProviders() {
  const providers = [
    { name: "OpenAI gpt-4o-mini", client: new OpenAI(), model: "gpt-4o-mini" },
    { name: "Anthropic claude-haiku", client: new Anthropic(), model: "claude-haiku-4-5" },
    // Uncomment if you have a Gemini API key
    // { name: "Gemini flash", client: new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }), model: "gemini-2.0-flash" },
  ];

  for (const { name, client, model } of providers) {
    console.log(`\n--- ${name} ---`);
    const start = Date.now();

    try {
      const { data } = await generate({
        client,
        model,
        schema: RecipeSchema,
        prompt,
        temperature: 0.3,
        trackUsage: true,
      });

      console.log(`Recipe: ${data.name}`);
      console.log(`Difficulty: ${data.difficulty}`);
      console.log(`Total time: ${data.prepTimeMinutes + data.cookTimeMinutes} minutes`);
      console.log(`Ingredients: ${data.ingredients.length}`);
      console.log(`Steps: ${data.steps.length}`);
      console.log(`Latency: ${Date.now() - start}ms`);
    } catch (err) {
      console.log(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

compareProviders().catch(console.error);
