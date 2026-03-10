// Event/calendar extraction — parse event announcements into calendar-ready objects
// Run: OPENAI_API_KEY=... npx tsx examples/35-event-calendar-extraction.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateArray } from "../src/index.js";

const client = new OpenAI();

const EventSchema = z.object({
  title: z.string(),
  type: z.enum(["conference", "meetup", "webinar", "workshop", "hackathon", "deadline", "other"]),
  startDate: z.string().describe("ISO 8601 datetime or date"),
  endDate: z.string().optional().describe("ISO 8601 datetime or date"),
  timezone: z.string().optional(),
  isAllDay: z.boolean(),
  location: z
    .object({
      type: z.enum(["in_person", "online", "hybrid"]),
      address: z.string().optional(),
      city: z.string().optional(),
      url: z.string().optional().describe("Online meeting link or registration URL"),
    })
    .optional(),
  organizer: z.string().optional(),
  description: z.string().optional(),
  registrationRequired: z.boolean(),
  cost: z.string().optional(),
  capacity: z.number().int().optional(),
  tags: z.array(z.string()),
  icalSummary: z.string().describe("One-line summary suitable for iCal SUMMARY field"),
});

const announcements = `
📢 Tech Events This Month:

1. React Summit US 2024
Join us May 22-24 in New York City for the biggest React conference in North America!
3 days, 60+ speakers, 1,500 attendees. Tickets from $299 (early bird ends April 1st).
Hybrid event — online streaming available for $49.
Venue: Jacob K. Javits Convention Center, Manhattan.
reactsummit.com/us

2. AI/ML Study Group Meetup
Monthly virtual meetup for ML practitioners. This month's topic: "Fine-tuning LLMs on custom data"
Date: Thursday, March 21st at 7 PM EST (30 min lightning talk + 30 min Q&A)
Free event. Register at: meetup.com/aiml-nyc
Max 200 participants on Zoom.

3. Hackathon: Build with Llama 3
March 30 – April 1 (48 hours). In-person, San Francisco.
$50,000 in prizes. Theme: open source AI tools.
Location: Caltrain Innovation Hub, 700 4th St, SF
Teams of 2-4. Free to participate. Food & drinks provided.
Register by March 28th.

4. Paper Submission Deadline — NeurIPS 2024
Abstract deadline: May 22, 2024 (11:59 PM AoE)
Full paper deadline: May 29, 2024 (11:59 PM AoE)
No in-person event. neurips.cc/Conferences/2024
`;

async function main() {
  const { data, usage } = await generateArray({
    client,
    model: "gpt-4o-mini",
    schema: EventSchema,
    prompt: announcements,
    systemPrompt:
      "Parse each event announcement as a separate item. Convert all dates to ISO 8601 format assuming year 2024.",
    trackUsage: true,
  });

  console.log(`Extracted ${data.length} events:\n`);

  data.forEach((event, i) => {
    console.log(`[${i + 1}] ${event.title}`);
    console.log(`    Type:  ${event.type} | ${event.isAllDay ? "All day" : "Timed"}`);
    console.log(`    Start: ${event.startDate}${event.endDate ? ` → ${event.endDate}` : ""}`);
    if (event.timezone) console.log(`    TZ:    ${event.timezone}`);
    if (event.location) {
      console.log(`    Where: ${event.location.type}${event.location.city ? ` (${event.location.city})` : ""}`);
      if (event.location.address) console.log(`           ${event.location.address}`);
      if (event.location.url) console.log(`           ${event.location.url}`);
    }
    if (event.cost) console.log(`    Cost:  ${event.cost}`);
    if (event.capacity) console.log(`    Cap:   ${event.capacity} attendees`);
    console.log(`    iCal:  ${event.icalSummary}`);
    console.log();
  });

  if (usage) console.log(`Tokens: ${usage.totalTokens}`);
}

main().catch(console.error);
