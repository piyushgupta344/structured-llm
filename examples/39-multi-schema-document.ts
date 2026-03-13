// Multi-schema document processing — extract different structured views from one document
// Run: OPENAI_API_KEY=... npx tsx examples/39-multi-schema-document.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateMultiSchema } from "../src/index.js";

const client = new OpenAI();

// Three completely different schemas applied to the same document simultaneously
const SummarySchema = z.object({
  executiveSummary: z.string().max(400),
  keyPoints: z.array(z.string()),
  targetAudience: z.string(),
  readingTimeMinutes: z.number().int(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
});

const QuotesSchema = z.object({
  quotes: z.array(
    z.object({
      text: z.string(),
      speaker: z.string().optional(),
      context: z.string(),
      type: z.enum(["data_point", "opinion", "warning", "tip", "prediction"]),
    })
  ),
  mostImpactfulQuote: z.string(),
});

const ActionSchema = z.object({
  immediateActions: z.array(
    z.object({
      action: z.string(),
      effort: z.enum(["low", "medium", "high"]),
      impact: z.enum(["low", "medium", "high"]),
    })
  ),
  tools: z.array(z.object({ name: z.string(), category: z.string(), purpose: z.string() })),
  topRecommendation: z.string(),
});

const article = `
Why Your LLM App Is Slower Than It Needs to Be

Last week, a client came to me with a straightforward problem: their AI feature was
taking 8-12 seconds per response, and users were churning. "Our model is just slow,"
they said. Three days later, we cut that to 900ms — a 10x improvement — without
changing the model at all.

Here's what we did:

1. Stop re-sending the same context on every call. The app was prepending 3,000 tokens
of static instructions on every single request. By switching to Anthropic's system cache,
we cut input tokens by 60% and saved $800/month. This was the single biggest win.

"Caching is the highest-leverage optimization in LLM apps," wrote Andrej Karpathy in
a recent tweet. "Most teams are leaving 50-80% of their token budget on the table."

2. Parallelize independent operations. The app called the LLM sequentially for 4
independent classification tasks. Switching to Promise.all reduced wall-clock time
from 4x to 1x latency.

3. Use the right model for the right task. They were using GPT-4o for everything,
including simple extraction tasks. Routing low-complexity tasks to GPT-4o-mini cut
costs by 70% on those queries with identical accuracy.

4. Stream responses. Users perceived much faster load times once we streamed tokens
progressively, even though total time was the same.

5. Add a response cache with TTL. 30% of their queries were duplicates. A simple
Redis cache with 1-hour TTL eliminated those entirely.

The takeaway: before you "upgrade your model" or "throw more hardware at it,"
audit how you're calling it. Most apps have at least 3 easy optimizations sitting
on the table.

Tools used in this project: Claude API, Redis (Upstash), Vercel Edge Functions,
LangSmith for tracing, OpenAI Tokenizer.
`;

async function main() {
  console.log("Processing document with 3 schemas simultaneously...\n");

  const { results, totalUsage } = await generateMultiSchema({
    client,
    model: "gpt-4o-mini",
    prompt: article,
    schemas: {
      summary: SummarySchema,
      quotes: QuotesSchema,
      actions: ActionSchema,
    },
    parallel: true,
  });

  // Summary
  if (results.summary.data) {
    const s = results.summary.data;
    console.log("SUMMARY");
    console.log(`Audience: ${s.targetAudience} | Difficulty: ${s.difficulty} | ~${s.readingTimeMinutes} min read`);
    console.log(`\n${s.executiveSummary}`);
    console.log("\nKey points:");
    s.keyPoints.forEach((p) => console.log(`  • ${p}`));
  }

  // Quotes
  if (results.quotes.data) {
    const q = results.quotes.data;
    console.log(`\nNOTABLE QUOTES (${q.quotes.length} total)`);
    q.quotes.slice(0, 3).forEach((quote) => {
      console.log(`  [${quote.type}] "${quote.text}"`);
      if (quote.speaker) console.log(`    — ${quote.speaker}`);
    });
    console.log(`\nMost impactful: "${q.mostImpactfulQuote}"`);
  }

  // Actions
  if (results.actions.data) {
    const a = results.actions.data;
    console.log(`\nACTION ITEMS`);
    console.log(`Top recommendation: ${a.topRecommendation}`);
    a.immediateActions.forEach((act) => {
      console.log(`  [effort:${act.effort} impact:${act.impact}] ${act.action}`);
    });
    console.log(`\nTools mentioned: ${a.tools.map((t) => t.name).join(", ")}`);
  }

  if (totalUsage) {
    console.log(`\nTotal tokens: ${totalUsage.totalTokens} (~$${totalUsage.estimatedCostUsd.toFixed(5)})`);
  }
}

main().catch(console.error);
