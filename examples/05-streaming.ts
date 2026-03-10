/**
 * Example: Streaming structured output
 *
 * Useful for: long-form generation, showing partial results as they come in,
 * building real-time UIs.
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/05-streaming.ts
 */

import OpenAI from "openai";
import { z } from "zod";
import { generateStream } from "../src/index.js";

const ReportSchema = z.object({
  title: z.string(),
  executiveSummary: z.string().describe("2-3 sentence summary"),
  keyFindings: z.array(
    z.object({
      finding: z.string(),
      impact: z.enum(["high", "medium", "low"]),
      evidence: z.string(),
    })
  ),
  recommendations: z.array(z.string()),
  conclusion: z.string(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
});

const openai = new OpenAI();

async function streamReport() {
  console.log("Generating report (streaming)...\n");

  const stream = generateStream({
    client: openai,
    model: "gpt-4o",
    schema: ReportSchema,
    prompt: `
      Write a detailed analysis report on the current state of AI adoption in the healthcare industry.
      Include key findings about diagnostic AI, administrative automation, and drug discovery.
      Be specific with examples and provide actionable recommendations.
    `,
    systemPrompt: "You are a healthcare industry analyst writing for hospital executives.",
    temperature: 0.3,
    trackUsage: true,
  });

  let lastPartialKeys = new Set<string>();

  for await (const event of stream) {
    const currentKeys = new Set(Object.keys(event.partial));

    // Print when new top-level fields appear
    for (const key of currentKeys) {
      if (!lastPartialKeys.has(key)) {
        const val = event.partial[key as keyof typeof event.partial];
        const preview =
          typeof val === "string"
            ? val.slice(0, 80) + (val.length > 80 ? "..." : "")
            : JSON.stringify(val)?.slice(0, 80);
        console.log(`  [${key}] ${preview}`);
      }
    }
    lastPartialKeys = currentKeys;

    if (event.isDone) {
      console.log("\n--- Complete report ---");
      console.log("Title:", event.partial.title);
      console.log("Risk Level:", event.partial.riskLevel);
      console.log(`Key Findings: ${event.partial.keyFindings?.length ?? 0}`);
      console.log(`Recommendations: ${event.partial.recommendations?.length ?? 0}`);
      if (event.usage) {
        console.log(`\nUsage: ${event.usage.totalTokens} tokens, $${event.usage.estimatedCostUsd?.toFixed(4)}`);
      }
    }
  }

  // Or just await the final result directly
  const { data } = await stream.result;
  console.log("\nFinal validated result:", data.title);
}

streamReport().catch(console.error);
