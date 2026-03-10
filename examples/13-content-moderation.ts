// Content moderation — classify and score user-generated content
// Run: OPENAI_API_KEY=... npx tsx examples/13-content-moderation.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const ModerationSchema = z.object({
  safe: z.boolean(),
  action: z.enum(["allow", "review", "block"]),
  categories: z.array(
    z.object({
      name: z.enum([
        "spam",
        "hate_speech",
        "harassment",
        "violence",
        "adult_content",
        "misinformation",
        "self_harm",
        "off_topic",
      ]),
      flagged: z.boolean(),
      confidence: z.number().min(0).max(1),
    })
  ),
  summary: z.string().describe("One sentence explanation of the decision"),
});

const testPosts = [
  "Just picked up the new GPU, can't wait to try it on some ML workloads!",
  "Buy followers cheap!! 10k followers for $5, DM me now!!!",
  "I honestly think people who disagree with me should just disappear.",
  "Has anyone tried the new hiking trail in Rocky Mountain National Park?",
];

async function moderatePost(content: string) {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: ModerationSchema,
    prompt: `Content to moderate:\n\n"${content}"`,
    systemPrompt: `You are a content moderation system. Analyze the content carefully and flag any policy violations.
Be conservative — err on the side of caution but avoid over-flagging normal discussion.`,
    temperature: 0,
  });
  return data;
}

async function main() {
  console.log("Running content moderation on test posts...\n");

  for (const post of testPosts) {
    const result = await moderatePost(post);
    const actionIcon = result.action === "allow" ? "✓" : result.action === "review" ? "⚠" : "✗";
    console.log(`[${actionIcon} ${result.action.toUpperCase()}] "${post.slice(0, 60)}..."`);
    console.log(`  Reason: ${result.summary}`);
    const flagged = result.categories.filter((c) => c.flagged);
    if (flagged.length > 0) {
      console.log(`  Flagged: ${flagged.map((c) => `${c.name} (${(c.confidence * 100).toFixed(0)}%)`).join(", ")}`);
    }
    console.log();
  }
}

main().catch(console.error);
