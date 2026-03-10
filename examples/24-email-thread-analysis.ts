// Email thread analysis — extract action items, decisions, and context from threads
// Run: OPENAI_API_KEY=... npx tsx examples/24-email-thread-analysis.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const EmailThreadSchema = z.object({
  subject: z.string(),
  participants: z.array(
    z.object({
      name: z.string(),
      email: z.string().optional(),
      role: z.string().optional(),
    })
  ),
  threadSummary: z.string(),
  keyDecisions: z.array(
    z.object({
      decision: z.string(),
      decidedBy: z.string().optional(),
      date: z.string().optional(),
    })
  ),
  actionItems: z.array(
    z.object({
      task: z.string(),
      assignedTo: z.string().optional(),
      dueDate: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]),
    })
  ),
  openQuestions: z.array(z.string()),
  sentiment: z.enum(["positive", "neutral", "tense", "contentious"]),
  requiresFollowUp: z.boolean(),
  nextMeeting: z.string().optional(),
});

const emailThread = `
From: Sarah Chen <sarah@acme.com>
To: dev-team@acme.com
Date: March 4, 2024, 9:15 AM
Subject: Re: Q1 launch timeline discussion

Hi all,

Following yesterday's call, I wanted to get alignment in writing.

The v2.0 launch is now confirmed for March 28. Marketing has already scheduled
the press release, so this is firm.

@Tom — can you confirm that the payment integration will be done by March 22
to give us time for QA? Last I heard you were blocked on Stripe's API docs.

Sarah

---

From: Tom Rodriguez <tom@acme.com>
Date: March 4, 2024, 10:30 AM

Sarah,

The Stripe integration should be done by March 20 assuming I get the API keys
from ops by EOD today. Javier — can you share those?

Also, we need to decide: are we shipping the analytics dashboard in this release
or pushing it to v2.1? It's about 40% done and will take another 2 weeks.

Tom

---

From: Javier Ortiz <javier@acme.com>
Date: March 4, 2024, 11:05 AM

Keys sent, Tom. Check your DMs.

On the analytics dashboard — I think we should push it to v2.1. Shipping a
half-baked feature will hurt more than help. Sarah, your call ultimately.

Also, don't forget we need to update the migration docs before launch. Who's
handling that? I'd do it but I'm deep in the auth refactor.

---

From: Sarah Chen <sarah@acme.com>
Date: March 4, 2024, 2:47 PM

Agreed, analytics goes to v2.1. Good call Javier.

Migration docs — Lisa, can you take this? It's probably 3-4 hours of work.
Need it done by March 25.

Let's sync again on March 18 to check status. I'll send a calendar invite.

Sarah
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: EmailThreadSchema,
    prompt: emailThread,
    systemPrompt: "Analyze this email thread and extract all structured information.",
    temperature: 0,
  });

  console.log(`Subject: ${data.subject}`);
  console.log(`Sentiment: ${data.sentiment} | Follow-up needed: ${data.requiresFollowUp ? "Yes" : "No"}`);
  if (data.nextMeeting) console.log(`Next meeting: ${data.nextMeeting}`);

  console.log(`\nParticipants: ${data.participants.map((p) => p.name).join(", ")}`);

  console.log(`\nSummary:\n  ${data.threadSummary}`);

  if (data.keyDecisions.length > 0) {
    console.log(`\nDecisions:`);
    data.keyDecisions.forEach((d) => {
      console.log(`  • ${d.decision}${d.decidedBy ? ` (${d.decidedBy})` : ""}`);
    });
  }

  console.log(`\nAction Items:`);
  data.actionItems.forEach((item) => {
    const due = item.dueDate ? ` — due ${item.dueDate}` : "";
    const who = item.assignedTo ? ` @${item.assignedTo}` : "";
    console.log(`  [${item.priority.toUpperCase()}]${who} ${item.task}${due}`);
  });

  if (data.openQuestions.length > 0) {
    console.log(`\nOpen Questions:`);
    data.openQuestions.forEach((q) => console.log(`  ? ${q}`));
  }
}

main().catch(console.error);
