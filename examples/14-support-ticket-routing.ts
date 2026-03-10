// Support ticket routing — classify and route customer support tickets
// Run: OPENAI_API_KEY=... npx tsx examples/14-support-ticket-routing.ts

import OpenAI from "openai";
import { classify } from "../src/index.js";

const client = new OpenAI();

const tickets = [
  {
    id: "TKT-001",
    subject: "Can't log into my account",
    body: "I've been trying for 20 minutes and keep getting 'invalid password'. I haven't changed it.",
  },
  {
    id: "TKT-002",
    subject: "Wrong charge on my credit card",
    body: "I was charged $49.99 on March 3rd but my plan is $9.99/month. Please refund the difference.",
  },
  {
    id: "TKT-003",
    subject: "How do I export my data?",
    body: "I want to download all my reports as CSV. I looked in settings but couldn't find it.",
  },
  {
    id: "TKT-004",
    subject: "Dashboard is loading very slowly",
    body: "The main dashboard takes 30+ seconds to load. This started yesterday. My internet is fine.",
  },
  {
    id: "TKT-005",
    subject: "Feature request: dark mode",
    body: "Would love a dark mode option. My eyes hurt after long sessions. Happy to beta test!",
  },
];

async function routeTicket(ticket: (typeof tickets)[0]) {
  const { label, confidence, reasoning } = await classify({
    client,
    model: "gpt-4o-mini",
    prompt: `Subject: ${ticket.subject}\n\n${ticket.body}`,
    options: [
      { value: "auth", description: "Login, password reset, 2FA issues" },
      { value: "billing", description: "Charges, refunds, subscription questions" },
      { value: "how-to", description: "Questions about how to use features" },
      { value: "bug", description: "Something broken or not working as expected" },
      { value: "feature-request", description: "Suggestions for new features or improvements" },
      { value: "other", description: "Anything that doesn't fit above" },
    ],
    includeConfidence: true,
    includeReasoning: true,
  });

  const teamMap: Record<string, string> = {
    auth: "Security Team",
    billing: "Finance Team",
    "how-to": "Support Bot → Docs",
    bug: "Engineering",
    "feature-request": "Product Team",
    other: "General Support",
  };

  const priority = label === "billing" || label === "auth" ? "HIGH" : "NORMAL";

  return { ticket, team: teamMap[label] ?? "General Support", label, confidence, reasoning, priority };
}

async function main() {
  console.log("Routing support tickets...\n");

  for (const ticket of tickets) {
    const result = await routeTicket(ticket);
    console.log(`${result.ticket.id} [${result.priority}] → ${result.team}`);
    console.log(`  Category:   ${result.label} (${(result.confidence! * 100).toFixed(0)}% confidence)`);
    console.log(`  Reasoning:  ${result.reasoning}`);
    console.log(`  Subject:    ${result.ticket.subject}`);
    console.log();
  }
}

main().catch(console.error);
