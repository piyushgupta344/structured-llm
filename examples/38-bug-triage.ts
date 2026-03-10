// Bug triage — analyze bug reports and assign priority, severity, and owner
// Run: OPENAI_API_KEY=... npx tsx examples/38-bug-triage.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateBatch } from "../src/index.js";

const client = new OpenAI();

const BugTriageSchema = z.object({
  title: z.string().describe("Clean, concise bug title"),
  severity: z.enum(["critical", "high", "medium", "low"]),
  priority: z.enum(["p0", "p1", "p2", "p3"]),
  component: z.enum(["auth", "payments", "api", "frontend", "mobile", "database", "infra", "other"]),
  type: z.enum(["regression", "new_bug", "performance", "security", "ux", "data_corruption"]),
  affectedUsers: z.enum(["all", "subset", "specific_user", "internal_only"]),
  reproductionRate: z.enum(["always", "intermittent", "rare", "unknown"]),
  suggestedOwner: z.string().describe("Team or role that should own this bug"),
  stepsToReproduce: z.array(z.string()),
  rootCauseHypothesis: z.string().optional(),
  immediateWorkaround: z.string().optional(),
  estimatedImpact: z.string().describe("Business impact in one sentence"),
  needsHotfix: z.boolean(),
  labels: z.array(z.string()),
});

const bugReports = [
  {
    id: "BUG-841",
    title: "Users getting logged out randomly",
    body: `Multiple users reporting that they're being logged out every 10-20 minutes even
after checking "remember me". Started yesterday after the auth service deploy.
Affects all users on Chrome desktop. Not reproducible on Firefox or mobile app.
Auth service logs show JWT validation errors for tokens that shouldn't be expired.
2,000+ affected users based on error logs.`,
  },
  {
    id: "BUG-842",
    title: "Checkout button sometimes doesn't respond on mobile",
    body: `About 3-5% of mobile users report that the checkout button doesn't do anything
on first tap. Second tap usually works. Reported on iOS Safari and Android Chrome.
No console errors visible. Revenue impact: we're losing an estimated 2% of mobile
conversions. Cannot reproduce consistently — seems timing-related.`,
  },
  {
    id: "BUG-843",
    title: "CSV export shows wrong column headers in some locales",
    body: `Users in German and French locales say CSV exports have English column headers
instead of localized ones. The data itself is correct. Only affects CSVs, not the UI.
Happened after the i18n refactor last sprint. Affects ~200 international users.
Easy workaround: users can rename columns manually.`,
  },
];

async function main() {
  console.log("Triaging bug reports...\n");

  const { succeeded, totalUsage } = await generateBatch({
    client,
    model: "gpt-4o-mini",
    schema: BugTriageSchema,
    concurrency: 3,
    inputs: bugReports.map((bug) => ({
      prompt: `Bug Report #${bug.id}\nTitle: ${bug.title}\n\n${bug.body}`,
      systemPrompt:
        "Triage this bug report. Be conservative — when in doubt about severity, go higher.",
      temperature: 0,
    })),
  });

  succeeded.forEach(({ data, index }) => {
    if (!data) return;
    const bug = bugReports[index];
    const hotfixFlag = data.needsHotfix ? " 🚨 HOTFIX NEEDED" : "";
    console.log(`${bug.id}: ${data.title}${hotfixFlag}`);
    console.log(`  Severity: ${data.severity.toUpperCase()} | Priority: ${data.priority.toUpperCase()}`);
    console.log(`  Component: ${data.component} | Type: ${data.type}`);
    console.log(`  Affected: ${data.affectedUsers} users | Repro: ${data.reproductionRate}`);
    console.log(`  Owner: ${data.suggestedOwner}`);
    console.log(`  Impact: ${data.estimatedImpact}`);
    if (data.rootCauseHypothesis) {
      console.log(`  Root cause: ${data.rootCauseHypothesis}`);
    }
    if (data.immediateWorkaround) {
      console.log(`  Workaround: ${data.immediateWorkaround}`);
    }
    console.log(`  Labels: ${data.labels.join(", ")}`);
    console.log();
  });

  if (totalUsage) {
    console.log(`Total tokens: ${totalUsage.totalTokens}`);
  }
}

main().catch(console.error);
