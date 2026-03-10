/**
 * Example: Financial analysis — the kind of thing devs actually build
 *
 * Parse earnings calls, extract financial metrics, classify SEC filings.
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/09-fintech-analysis.ts
 */

import OpenAI from "openai";
import { z } from "zod";
import { generate, generateArray } from "../src/index.js";

// Schema for an earnings call analysis
const EarningsSchema = z.object({
  ticker: z.string(),
  quarter: z.string(),
  revenue: z.object({
    reported: z.number().describe("In millions USD"),
    yoyGrowth: z.number().describe("Percentage"),
    beatExpectations: z.boolean(),
  }),
  eps: z.object({
    diluted: z.number(),
    yoyGrowth: z.number(),
    beatExpectations: z.boolean(),
  }),
  guidance: z.object({
    nextQuarterRevenue: z.object({ low: z.number(), high: z.number() }).optional(),
    raised: z.boolean(),
    commentary: z.string(),
  }),
  keyMetrics: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
      trend: z.enum(["up", "down", "flat"]),
    })
  ),
  risks: z.array(z.string()),
  sentiment: z.enum(["bullish", "neutral", "bearish"]),
  analystRating: z.enum(["strong-buy", "buy", "hold", "sell", "strong-sell"]),
});

// Schema for individual financial headlines
const FinancialHeadlineSchema = z.object({
  headline: z.string(),
  ticker: z.string().optional(),
  impact: z.enum(["positive", "negative", "neutral"]),
  magnitude: z.enum(["minor", "moderate", "major"]),
  sectors: z.array(z.string()),
  tradingImplication: z.string(),
});

const earningsTranscriptExcerpt = `
Apple Inc. Q4 FY2025 Earnings Call

Revenue came in at $94.9 billion, up 5.3% year-over-year, beating analyst consensus of $94.3B.
Diluted EPS was $1.64, up 12.3% YoY, beating expectations of $1.60.

iPhone revenue: $46.2B (+3% YoY) - slightly below expectations due to China headwinds
Services revenue: $26.3B (+14% YoY) - record quarter, now highest margin segment
Mac revenue: $9.1B (+8% YoY) - M4 chip transition driving upgrades
iPad revenue: $6.9B (+11% YoY) - back to school season performed well

For Q1 FY2026, Apple guided revenue of $124-130B, above consensus of $123.5B.

CFO Luca Maestri: "We're seeing continued momentum in Services, and Apple Intelligence is
driving meaningful upgrade cycles in our installed base."

Key risks mentioned:
- Ongoing China regulatory environment uncertainty
- Potential tariff impacts on hardware margins
- Currency headwinds (strong USD impact on international revenue ~$1.5B headwind)

Active installed base reached 2.3 billion devices.
`;

const headlines = [
  "Fed signals pause in rate hikes as inflation falls to 2.1%; markets rally",
  "Silicon Valley Bank collapse triggers regional banking selloff; FDIC intervenes",
  "NVIDIA beats Q3 earnings by 40%, raises guidance on AI chip demand",
];

const openai = new OpenAI();

async function analyzeEarnings() {
  console.log("=== Earnings Analysis ===\n");

  const { data } = await generate({
    client: openai,
    model: "gpt-4o-mini",
    schema: EarningsSchema,
    prompt: `Analyze this earnings call transcript and extract all key financial metrics:\n\n${earningsTranscriptExcerpt}`,
    systemPrompt: "You are a financial analyst. Extract precise numbers and provide objective analysis.",
    temperature: 0,
  });

  console.log(`${data.ticker} ${data.quarter}`);
  console.log(`Revenue: $${data.revenue.reported}M (${data.revenue.yoyGrowth > 0 ? "+" : ""}${data.revenue.yoyGrowth}% YoY, ${data.revenue.beatExpectations ? "BEAT" : "MISS"})`);
  console.log(`EPS: $${data.eps.diluted} (${data.eps.yoyGrowth > 0 ? "+" : ""}${data.eps.yoyGrowth}% YoY, ${data.eps.beatExpectations ? "BEAT" : "MISS"})`);
  console.log(`Guidance: ${data.guidance.raised ? "RAISED" : "Maintained"} — ${data.guidance.commentary}`);
  console.log(`Sentiment: ${data.sentiment.toUpperCase()} | Rating: ${data.analystRating}`);
  console.log("\nKey Metrics:");
  for (const m of data.keyMetrics) {
    console.log(`  ${m.name}: ${m.value} (${m.trend})`);
  }
  console.log("\nRisks:");
  data.risks.forEach((r) => console.log(`  - ${r}`));
}

async function analyzeHeadlines() {
  console.log("\n\n=== Headline Analysis ===\n");

  const { data: analyzed } = await generateArray({
    client: openai,
    model: "gpt-4o-mini",
    schema: FinancialHeadlineSchema,
    prompt: `Analyze each of these financial news headlines:\n\n${headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
  });

  for (const item of analyzed) {
    console.log(`"${item.headline.slice(0, 70)}..."`);
    console.log(`  Impact: ${item.impact.toUpperCase()} (${item.magnitude})`);
    console.log(`  Sectors: ${item.sectors.join(", ")}`);
    console.log(`  Trade implication: ${item.tradingImplication}\n`);
  }
}

async function main() {
  await analyzeEarnings();
  await analyzeHeadlines();
}

main().catch(console.error);
