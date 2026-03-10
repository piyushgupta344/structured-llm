// Competitor analysis — extract and compare competitor feature sets from web content
// Run: OPENAI_API_KEY=... npx tsx examples/33-competitor-analysis.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateBatch } from "../src/index.js";

const client = new OpenAI();

const CompetitorSchema = z.object({
  name: z.string(),
  tagline: z.string().optional(),
  pricingModel: z.enum(["free", "freemium", "subscription", "usage_based", "enterprise", "one_time"]),
  startingPrice: z.string().optional(),
  targetCustomer: z.string(),
  coreFeatures: z.array(z.string()),
  uniqueSellingPoints: z.array(z.string()),
  limitations: z.array(z.string()),
  integrations: z.array(z.string()),
  techStack: z.array(z.string()).optional(),
  fundingStage: z.enum(["bootstrapped", "seed", "series_a", "series_b+", "public", "unknown"]),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
});

// Simulated scrapes of competitor "About" pages
const competitorPages = [
  {
    name: "LinearAI",
    content: `LinearAI — The project management tool built for modern software teams.
LinearAI combines intelligent sprint planning with automatic ticket generation from Slack conversations.
Pricing: Free for up to 5 users, $8/user/month for teams, custom enterprise pricing.
Key features: AI-powered issue creation, automatic sprint planning, GitHub/GitLab integration,
real-time collaboration, cycle time analytics, roadmap view.
Used by over 8,000 engineering teams. Series B, $45M raised.
Slack, GitHub, GitLab, Figma, Sentry integrations.
Known issues: No time tracking, limited reporting for non-engineers.`,
  },
  {
    name: "TaskFlow Pro",
    content: `TaskFlow Pro — Work management for everyone, powered by AI.
From marketing teams to ops, TaskFlow Pro adapts to any workflow.
$0 forever free plan. Teams from $12/user/month. Enterprise: custom.
Features: Custom fields, automation rules, AI task suggestions, time tracking,
resource management, Gantt charts, 200+ integrations via Zapier.
Bootstrapped and profitable. 50,000+ customers.
Weaknesses noted in reviews: UI can feel overwhelming, slow customer support,
mobile app lags behind desktop.`,
  },
  {
    name: "SprintOS",
    content: `SprintOS is the AI-first agile platform that writes your standups, scores your tickets,
and predicts sprint outcomes before they happen.
Usage-based pricing: starts at $0.02 per AI operation. Subscription tier at $25/user/month.
Core: natural language to Jira-style issues, automated standup summaries, velocity prediction,
dependency detection. Integrates with Jira, Linear, Azure DevOps.
Seed stage, $3M raised. Built on OpenAI GPT-4.
Early stage — some features unstable, limited enterprise security features.`,
  },
];

async function main() {
  console.log("Analyzing competitors...\n");

  const { succeeded, failed, totalUsage } = await generateBatch({
    client,
    model: "gpt-4o-mini",
    schema: CompetitorSchema,
    concurrency: 3,
    inputs: competitorPages.map((page) => ({
      prompt: `Company: ${page.name}\n\n${page.content}`,
      systemPrompt: "Extract structured competitive intelligence from this company description.",
    })),
  });

  if (failed.length > 0) {
    console.warn(`Failed to analyze ${failed.length} competitors`);
  }

  const competitors = succeeded.map((r) => r.data!);

  // comparison table
  console.log("COMPETITOR COMPARISON\n");
  console.log(`${"Company".padEnd(14)} | ${"Pricing".padEnd(14)} | ${"Starting".padEnd(12)} | Target`);
  console.log("-".repeat(70));
  competitors.forEach((c) => {
    console.log(
      `${c.name.padEnd(14)} | ${c.pricingModel.padEnd(14)} | ${(c.startingPrice ?? "N/A").padEnd(12)} | ${c.targetCustomer.slice(0, 30)}`
    );
  });

  console.log("\n\nDETAILED ANALYSIS\n");
  competitors.forEach((c) => {
    console.log(`${c.name} (${c.fundingStage})`);
    if (c.tagline) console.log(`  "${c.tagline}"`);
    console.log(`  Strengths:  ${c.strengths.slice(0, 2).join("; ")}`);
    console.log(`  Weaknesses: ${c.weaknesses.slice(0, 2).join("; ")}`);
    console.log(`  USPs: ${c.uniqueSellingPoints.slice(0, 2).join("; ")}`);
    console.log(`  Integrations: ${c.integrations.slice(0, 4).join(", ")}`);
    console.log();
  });

  if (totalUsage) {
    console.log(`Total: ${totalUsage.totalTokens} tokens (~$${totalUsage.estimatedCostUsd.toFixed(4)})`);
  }
}

main().catch(console.error);
