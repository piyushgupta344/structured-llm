/**
 * Example: Extract structured data from unstructured text
 *
 * A classic use case — turn a blob of text (email, document, etc.) into
 * a typed object you can actually work with.
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/02-data-extraction.ts
 */

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const MeetingSchema = z.object({
  title: z.string(),
  date: z.string().describe("ISO 8601 date string if determinable, else the raw text"),
  time: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(
    z.object({
      name: z.string(),
      email: z.string().email().optional(),
      role: z.string().optional(),
    })
  ),
  agenda: z.array(z.string()),
  actionItems: z.array(
    z.object({
      task: z.string(),
      owner: z.string().optional(),
      dueDate: z.string().optional(),
    })
  ),
  decisions: z.array(z.string()),
});

const meetingNotes = `
Team Sync - Q4 Planning
Date: November 15th, 2025 at 2:30 PM
Location: Conference Room B / Zoom (link in calendar)

Attendees:
- Sarah Chen (Engineering Lead, sarah@acme.com)
- Marcus Johnson (Product Manager)
- Priya Patel (Designer, priya@acme.com)
- Tom Williams (CTO)

Agenda:
1. Q3 retrospective
2. Q4 roadmap review
3. Resource allocation
4. New hire updates

Notes:
We reviewed Q3 metrics — overall good but mobile conversion lagged.
Decided to prioritize the mobile checkout redesign for Q4 (owned by Priya, due Dec 1).
Marcus to write detailed PRD for the new recommendation engine by Nov 22.
Tom approved budget increase for AWS infrastructure.
Sarah will schedule 3 interviews for the senior engineer role next week.

Next meeting: Nov 22nd, same time.
`;

const openai = new OpenAI();

async function extractMeetingData() {
  console.log("Extracting meeting data from notes...\n");

  const { data } = await generate({
    client: openai,
    model: "gpt-4o-mini",
    schema: MeetingSchema,
    prompt: `Extract all structured information from these meeting notes:\n\n${meetingNotes}`,
    temperature: 0,
  });

  console.log("Title:", data.title);
  console.log("Date:", data.date, data.time ? `at ${data.time}` : "");
  console.log("Location:", data.location);
  console.log("\nAttendees:");
  for (const a of data.attendees) {
    console.log(`  - ${a.name}${a.email ? ` (${a.email})` : ""}${a.role ? ` — ${a.role}` : ""}`);
  }
  console.log("\nAgenda:");
  data.agenda.forEach((item, i) => console.log(`  ${i + 1}. ${item}`));
  console.log("\nAction Items:");
  for (const item of data.actionItems) {
    console.log(`  - ${item.task}${item.owner ? ` [${item.owner}]` : ""}${item.dueDate ? ` (due: ${item.dueDate})` : ""}`);
  }
  console.log("\nDecisions:");
  data.decisions.forEach((d) => console.log(`  - ${d}`));
}

extractMeetingData().catch(console.error);
