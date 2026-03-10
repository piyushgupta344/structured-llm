// Review aggregation — analyze multiple product reviews into aggregate insights
// Run: OPENAI_API_KEY=... npx tsx examples/32-review-aggregation.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateArray, generate } from "../src/index.js";

const client = new OpenAI();

// Step 1: parse each review
const ReviewSchema = z.object({
  rating: z.number().min(1).max(5),
  sentiment: z.enum(["positive", "mixed", "negative"]),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  usecaseType: z.enum(["casual", "professional", "gift", "replacement", "first_time"]).optional(),
  verifiedPurchase: z.boolean().optional(),
});

// Step 2: aggregate
const AggregateSchema = z.object({
  avgRating: z.number(),
  totalReviews: z.number().int(),
  sentimentBreakdown: z.object({
    positive: z.number().describe("percentage"),
    mixed: z.number().describe("percentage"),
    negative: z.number().describe("percentage"),
  }),
  topPros: z.array(z.object({ point: z.string(); frequency: z.number() })),
  topCons: z.array(z.object({ point: z.string(); frequency: z.number() })),
  buyRecommendation: z.enum(["highly_recommend", "recommend", "mixed", "not_recommend"]),
  summary: z.string().max(300),
  targetAudience: z.string(),
});

const rawReviews = [
  `⭐⭐⭐⭐⭐ - Amazing noise cancellation! Been using these Sony WH-1000XM5 headphones for 3 months now.
The ANC is truly impressive — completely blocks out my open office. Battery lasts 30+ hours.
Sound quality is stellar. Only minor con: they're a bit tight after long sessions. Highly recommend!`,

  `⭐⭐⭐ - Mixed feelings. The sound quality is excellent and ANC works well but the headband
cracked after 4 months of normal use. Sony replaced them under warranty, which was easy,
but I'm nervous about durability. Great sound, questionable build for the price.`,

  `⭐⭐⭐⭐⭐ - Best headphones I've ever owned. I'm a musician and the audio fidelity is
outstanding. Multi-device switching is seamless (MacBook to iPhone). The companion app is
great too — customizable EQ, speak-to-chat feature is surprisingly useful.`,

  `⭐⭐ - Overhyped. The "industry-leading ANC" doesn't live up to expectations. My old
Bose QC45 had better isolation for low frequencies. Also, they don't fold flat so they're
annoying to pack. Sound is good but not $350 good in my opinion.`,

  `⭐⭐⭐⭐ - Excellent for work from home. Comfortable for 6+ hour sessions (tested!),
the microphone quality is decent for video calls, and battery life is exceptional.
The carrying case is a nice touch. Would buy again.`,
];

async function main() {
  console.log("Parsing individual reviews...\n");

  // parse reviews in batch
  const { data: parsedReviews } = await generateArray({
    client,
    model: "gpt-4o-mini",
    schema: ReviewSchema,
    prompt: rawReviews.map((r, i) => `Review ${i + 1}:\n${r}`).join("\n\n---\n\n"),
    systemPrompt: "Parse each numbered review as a separate array item. Extract pros and cons as concise phrases.",
  });

  console.log(`Parsed ${parsedReviews.length} reviews`);
  parsedReviews.forEach((r, i) => {
    console.log(`  Review ${i + 1}: ${r.rating}★ (${r.sentiment}) | Pros: ${r.pros.length} | Cons: ${r.cons.length}`);
  });

  // aggregate
  console.log("\nAggregating insights...\n");

  const { data: agg } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: AggregateSchema,
    prompt: `Here are ${parsedReviews.length} parsed reviews for Sony WH-1000XM5 headphones:\n\n${JSON.stringify(parsedReviews, null, 2)}`,
    systemPrompt: "Aggregate these parsed reviews into overall insights. Calculate frequencies of repeated themes.",
  });

  console.log(`Product: Sony WH-1000XM5 Headphones`);
  console.log(`Average Rating: ${agg.avgRating.toFixed(1)}/5 (${agg.totalReviews} reviews)`);
  console.log(
    `Sentiment: ${agg.sentimentBreakdown.positive}% positive, ${agg.sentimentBreakdown.mixed}% mixed, ${agg.sentimentBreakdown.negative}% negative`
  );
  console.log(`Recommendation: ${agg.buyRecommendation.replace(/_/g, " ")}`);

  console.log(`\nTop Pros:`);
  agg.topPros.forEach((p) => console.log(`  • ${p.point} (${p.frequency}x)`));

  console.log(`\nTop Cons:`);
  agg.topCons.forEach((c) => console.log(`  • ${c.point} (${c.frequency}x)`));

  console.log(`\nTarget Audience: ${agg.targetAudience}`);
  console.log(`\nSummary: ${agg.summary}`);
}

main().catch(console.error);
