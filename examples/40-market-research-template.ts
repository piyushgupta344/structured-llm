// Market research templating — run the same research prompt across multiple markets
// Run: OPENAI_API_KEY=... npx tsx examples/40-market-research-template.ts

import OpenAI from "openai";
import { z } from "zod";
import { createTemplate } from "../src/index.js";

const client = new OpenAI();

const MarketSchema = z.object({
  market: z.string(),
  marketSizeUsd: z.string().optional().describe("e.g. '$4.2B in 2024'"),
  growthRate: z.string().optional().describe("e.g. '18% CAGR'"),
  keyPlayers: z.array(
    z.object({
      name: z.string(),
      estimatedShare: z.string().optional(),
      differentiator: z.string(),
    })
  ),
  customerSegments: z.array(
    z.object({
      segment: z.string(),
      size: z.enum(["small", "medium", "large"]),
      willingnessToPay: z.enum(["low", "medium", "high"]),
    })
  ),
  entryBarriers: z.array(z.string()),
  trends: z.array(z.string()),
  regulatoryConsiderations: z.array(z.string()),
  opportunityScore: z.number().min(1).max(10),
  recommendation: z.enum(["enter", "consider", "avoid", "partner"]),
  rationale: z.string().max(300),
});

// Create reusable research template
const researchTemplate = createTemplate({
  template: `Conduct a market analysis for the {{product}} industry in {{region}}.

Focus year: {{year}}
Analysis purpose: {{purpose}}

Please provide a structured market assessment based on your knowledge of this industry.`,
  schema: MarketSchema,
  client,
  model: "gpt-4o-mini",
  systemPrompt: `You are a senior market research analyst. Provide data-driven market assessments
based on publicly available information. Be realistic and specific. Acknowledge uncertainty
where data is limited.`,
  temperature: 0.3,
});

const markets = [
  {
    product: "AI-powered legal tech",
    region: "United States",
    year: "2024",
    purpose: "Series A investment decision",
  },
  {
    product: "sustainable packaging",
    region: "European Union",
    year: "2024",
    purpose: "market entry strategy",
  },
  {
    product: "B2B embedded finance / fintech-as-a-service",
    region: "Southeast Asia",
    year: "2024",
    purpose: "partnership opportunity evaluation",
  },
];

async function main() {
  console.log("Running market research across 3 markets...\n");
  console.log("(Using template with shared schema — only vars change)\n");

  for (const vars of markets) {
    console.log(`Analyzing: ${vars.product} in ${vars.region}...`);
    const { data } = await researchTemplate.run(vars);

    const recEmoji = { enter: "✅", consider: "🟡", avoid: "🔴", partner: "🤝" }[data.recommendation];
    console.log(`\n${recEmoji} ${data.recommendation.toUpperCase()}: ${data.market}`);
    console.log(`  Size: ${data.marketSizeUsd ?? "N/A"} | Growth: ${data.growthRate ?? "N/A"}`);
    console.log(`  Opportunity: ${data.opportunityScore}/10`);
    console.log(`  Rationale: ${data.rationale}`);

    console.log(`  Key players (${data.keyPlayers.length}):`);
    data.keyPlayers.slice(0, 3).forEach((p) => {
      console.log(`    • ${p.name}${p.estimatedShare ? ` (${p.estimatedShare})` : ""} — ${p.differentiator}`);
    });

    console.log(`  Top trends: ${data.trends.slice(0, 2).join("; ")}`);

    if (data.entryBarriers.length > 0) {
      console.log(`  Entry barriers: ${data.entryBarriers.slice(0, 2).join("; ")}`);
    }

    if (data.regulatoryConsiderations.length > 0) {
      console.log(`  Regulatory: ${data.regulatoryConsiderations[0]}`);
    }

    console.log("\n---\n");
  }

  // Render a template without calling the LLM (useful for debugging)
  console.log("Template preview (rendered without LLM call):");
  const preview = researchTemplate.render({
    product: "quantum computing software",
    region: "global",
    year: "2025",
    purpose: "strategic planning",
  });
  console.log(preview.split("\n").map((l) => `  ${l}`).join("\n"));
}

main().catch(console.error);
