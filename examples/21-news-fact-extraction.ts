// News article fact extraction — pull entities, claims, and metadata from articles
// Run: OPENAI_API_KEY=... npx tsx examples/21-news-fact-extraction.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const ArticleSchema = z.object({
  headline: z.string(),
  publishedDate: z.string().optional(),
  source: z.string().optional(),
  authors: z.array(z.string()),
  category: z.enum(["politics", "business", "technology", "science", "health", "sports", "entertainment", "world", "other"]),
  keyClaims: z.array(
    z.object({
      claim: z.string(),
      verifiable: z.boolean().describe("Can this be checked against public data?"),
      sentiment: z.enum(["positive", "negative", "neutral"]),
    })
  ),
  entities: z.object({
    people: z.array(z.object({ name: z.string(), role: z.string().optional() })),
    organizations: z.array(z.object({ name: z.string(), type: z.string().optional() })),
    locations: z.array(z.string()),
    dates: z.array(z.string()),
    money: z.array(z.string()),
  }),
  summary: z.string().max(200),
  toneAnalysis: z.object({
    objectivity: z.number().min(0).max(1).describe("0 = very biased, 1 = very objective"),
    urgency: z.enum(["low", "medium", "high"]),
  }),
});

const article = `
OpenAI Closes $6.6 Billion Funding Round at $157 Billion Valuation

SAN FRANCISCO — OpenAI announced Wednesday that it has secured $6.6 billion in new
funding, valuing the ChatGPT maker at $157 billion, one of the largest private funding
rounds in Silicon Valley history.

The investment was led by Thrive Capital, with participation from Microsoft, NVIDIA,
SoftBank, and other investors. CEO Sam Altman called it "a significant milestone for
our mission to ensure that AGI benefits all of humanity."

The funding comes amid increasing competition from Anthropic, Google DeepMind, and
Meta AI. OpenAI plans to use the capital to expand data center infrastructure and
accelerate research on GPT-5, expected to launch in early 2025.

The company lost approximately $5 billion in 2024 on $3.7 billion in revenue,
according to sources familiar with the matter. Despite the losses, investors remain
bullish on the company's long-term prospects in the AI market, projected to reach
$1 trillion by 2030 (Goldman Sachs Research, 2024).

Altman indicated that the company is "on track to profitability by 2026" and
confirmed plans to transition from a capped-profit model to a fully for-profit
structure pending board approval.
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: ArticleSchema,
    prompt: article,
    systemPrompt: "Extract structured information from this news article. Be precise and objective.",
  });

  console.log(`Headline: ${data.headline}`);
  console.log(`Category: ${data.category} | Authors: ${data.authors.join(", ") || "Unknown"}`);
  console.log(`\nSummary: ${data.summary}`);

  console.log(`\nTone: Objectivity ${(data.toneAnalysis.objectivity * 100).toFixed(0)}% | Urgency: ${data.toneAnalysis.urgency}`);

  console.log(`\nKey Claims (${data.keyClaims.length}):`);
  data.keyClaims.slice(0, 4).forEach((claim) => {
    const icon = claim.sentiment === "positive" ? "+" : claim.sentiment === "negative" ? "-" : "~";
    const v = claim.verifiable ? "[verifiable]" : "[unverifiable]";
    console.log(`  [${icon}] ${v} ${claim.claim}`);
  });

  console.log(`\nEntities:`);
  if (data.entities.people.length) {
    console.log(`  People: ${data.entities.people.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(", ")}`);
  }
  if (data.entities.organizations.length) {
    console.log(`  Orgs:   ${data.entities.organizations.map((o) => o.name).join(", ")}`);
  }
  if (data.entities.money.length) {
    console.log(`  Money:  ${data.entities.money.join(", ")}`);
  }
}

main().catch(console.error);
