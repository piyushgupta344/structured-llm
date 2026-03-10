/**
 * Example: createClient for reusable configuration
 *
 * When you're making many calls with the same settings — same provider,
 * model, and defaults — createClient avoids repeating yourself.
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/07-create-client.ts
 */

import OpenAI from "openai";
import { z } from "zod";
import { createClient } from "../src/index.js";

// Define reusable schemas
const EmailIntentSchema = z.object({
  intent: z.enum(["inquiry", "complaint", "request", "feedback", "spam", "other"]),
  urgency: z.enum(["low", "medium", "high"]),
  requiresResponse: z.boolean(),
  summary: z.string().max(100),
  suggestedReply: z.string().optional(),
});

const ContactInfoSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

// Set up once, use everywhere
const openai = new OpenAI();

const llm = createClient({
  client: openai,
  model: "gpt-4o-mini",
  defaultOptions: {
    temperature: 0,
    maxRetries: 2,
    trackUsage: true,
    hooks: {
      onRetry: ({ attempt, error, model }) => {
        console.warn(`[${model}] Retry ${attempt}: ${error}`);
      },
      onSuccess: ({ usage }) => {
        if (usage) {
          // could push to your analytics here
          process.stdout.write(`  [${usage.totalTokens} tokens / $${usage.estimatedCostUsd?.toFixed(5)}]\n`);
        }
      },
    },
  },
});

const emails = [
  {
    from: "angry.customer@email.com",
    body: "I ordered 3 weeks ago and still haven't received anything! This is completely unacceptable. I want a full refund immediately. Order #92847.",
  },
  {
    from: "john.doe@bigcorp.com",
    body: "Hi, could you send over your enterprise pricing for a team of 50 people? We're evaluating several solutions this quarter.",
  },
  {
    from: "newsletter@promo.example",
    body: "CONGRATULATIONS! You've been selected! Click here to claim your prize! Limited time offer!!!",
  },
];

async function processEmails() {
  for (const email of emails) {
    console.log(`\nEmail from: ${email.from}`);
    console.log(`Preview: "${email.body.slice(0, 70)}..."\n`);

    // Analyze intent
    const { data: intent } = await llm.generate({
      schema: EmailIntentSchema,
      prompt: `Analyze this customer email:\n\n${email.body}`,
      systemPrompt: "You are a customer support triage system.",
    });

    console.log(`  Intent: ${intent.intent} (urgency: ${intent.urgency})`);
    console.log(`  Requires response: ${intent.requiresResponse}`);
    console.log(`  Summary: ${intent.summary}`);

    // Also extract any contact info
    const { data: contact } = await llm.generate({
      schema: ContactInfoSchema,
      prompt: `Extract any contact information from this email. Email from: ${email.from}\n\nBody: ${email.body}`,
    });

    if (contact.name || contact.company) {
      console.log(`  Contact: ${[contact.name, contact.company].filter(Boolean).join(" at ")}`);
    }
  }
}

processEmails().catch(console.error);
