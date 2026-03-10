// Podcast show notes generator — extract chapters, guests, and links from transcripts
// Run: OPENAI_API_KEY=... npx tsx examples/31-podcast-show-notes.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const ShowNotesSchema = z.object({
  episodeTitle: z.string(),
  episodeNumber: z.number().int().optional(),
  guests: z.array(
    z.object({
      name: z.string(),
      title: z.string().optional(),
      company: z.string().optional(),
      socialHandles: z.array(z.string()),
    })
  ),
  chapters: z.array(
    z.object({
      timestamp: z.string().describe("e.g. 00:05:30"),
      title: z.string(),
      summary: z.string().max(150),
    })
  ),
  keyInsights: z.array(z.string()),
  resources: z.array(
    z.object({
      title: z.string(),
      type: z.enum(["book", "article", "tool", "website", "paper", "other"]),
      mentioned_by: z.string().optional(),
    })
  ),
  quotableQuotes: z.array(
    z.object({
      quote: z.string(),
      speaker: z.string(),
    })
  ),
  description: z.string().max(500).describe("SEO-friendly episode description"),
  tags: z.array(z.string()),
});

const transcript = `
[00:00:00] Host: Welcome to The Builder's Podcast! I'm your host Jamie Rivera and today
we have a fantastic guest — Dr. Priya Mehta, who is the CTO of Synthwave AI and
author of "The Compound Effect in Machine Learning." Welcome Priya!

[00:01:05] Priya: Thanks Jamie, really excited to be here!

[00:02:30] Jamie: Let's start with your background. You went from academic research
to building a $50M ARR AI company. How did that happen?

[00:03:00] Priya: It really came down to finding a problem I cared about solving.
In research you're optimizing for publications, but entrepreneurship is about
relentlessly solving real pain. The skills transfer but the mindset shift is huge.

[00:15:20] Jamie: Let's talk about your book. The main thesis is that small,
consistent improvements in ML models compound over time. Can you explain that?

[00:15:45] Priya: Absolutely. Most people focus on breakthrough innovations, but
a 1% improvement in accuracy per week — if you can sustain that — means you're
2x better in about 70 weeks. The real moat isn't one genius model, it's a
compounding data flywheel and iteration culture.

[00:28:10] Jamie: What tools or resources would you recommend for builders?

[00:28:30] Priya: I think everyone should read "Competing Against Luck" by Clayton
Christensen — it fundamentally changed how I think about product-market fit.
For ML practitioners, Andrej Karpathy's blog is invaluable. And for building
AI products specifically, the book "The Alignment Problem" by Brian Christian
is essential context.

[00:42:00] Jamie: What does the future of AI products look like to you?

[00:42:10] Priya: I genuinely believe we're moving from AI as a feature to AI as
the product. The companies that win won't be the ones with the best foundation
model, but the ones with the best feedback loops and data flywheels.

[00:55:00] Jamie: Amazing. Where can people find you and the book?

[00:55:10] Priya: Twitter/X @priyamehta_ai, LinkedIn, and the book is on Amazon.
Synthwave AI is at synthwave.ai — we're hiring!

[00:56:00] Jamie: That's a wrap! Thanks so much Priya.
`;

async function main() {
  const { data, usage } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: ShowNotesSchema,
    prompt: transcript,
    systemPrompt: "Generate comprehensive, SEO-optimized podcast show notes from this transcript.",
    trackUsage: true,
  });

  console.log(`Episode: ${data.episodeTitle}`);
  if (data.episodeNumber) console.log(`Number: #${data.episodeNumber}`);

  console.log(`\nGuests:`);
  data.guests.forEach((g) => {
    console.log(`  ${g.name}${g.title ? `, ${g.title}` : ""}${g.company ? ` @ ${g.company}` : ""}`);
    if (g.socialHandles.length) console.log(`    ${g.socialHandles.join(", ")}`);
  });

  console.log(`\nChapters:`);
  data.chapters.forEach((ch) => {
    console.log(`  [${ch.timestamp}] ${ch.title}`);
    console.log(`    ${ch.summary}`);
  });

  console.log(`\nKey Insights:`);
  data.keyInsights.forEach((i) => console.log(`  • ${i}`));

  if (data.quotableQuotes.length > 0) {
    console.log(`\nQuotable Quotes:`);
    data.quotableQuotes.slice(0, 2).forEach((q) => {
      console.log(`  "${q.quote}"`);
      console.log(`  — ${q.speaker}`);
    });
  }

  console.log(`\nResources Mentioned:`);
  data.resources.forEach((r) => {
    console.log(`  [${r.type}] ${r.title}${r.mentioned_by ? ` (mentioned by ${r.mentioned_by})` : ""}`);
  });

  console.log(`\nDescription:\n  ${data.description}`);
  console.log(`\nTags: ${data.tags.join(", ")}`);

  if (usage) console.log(`\nTokens: ${usage.totalTokens}`);
}

main().catch(console.error);
