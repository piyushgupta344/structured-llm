// Symptom triage assistant — parse symptoms and suggest urgency level
// For demonstration only — NOT a medical device. Always consult a doctor.
// Run: OPENAI_API_KEY=... npx tsx examples/30-symptom-triage.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const TriageSchema = z.object({
  urgency: z.enum(["call_911", "er_now", "urgent_care_today", "see_doctor_soon", "home_care", "monitor"]),
  urgencyReasoning: z.string(),
  extractedSymptoms: z.array(
    z.object({
      symptom: z.string(),
      duration: z.string().optional(),
      severity: z.enum(["mild", "moderate", "severe"]).optional(),
    })
  ),
  redFlags: z.array(z.string()).describe("Symptoms that indicate potential emergency"),
  possibleCauses: z.array(
    z.object({
      condition: z.string(),
      likelihood: z.enum(["low", "moderate", "high"]),
    })
  ),
  homeCareTips: z.array(z.string()),
  whenToEscalate: z.string().describe("Instructions on when to seek immediate care"),
  disclaimer: z.string(),
});

const patientInputs = [
  "I have a throbbing headache for 3 days, mild fever around 100.2, and my neck feels a bit stiff when I try to touch my chin to my chest.",
  "I cut my finger pretty deep while cooking, it won't stop bleeding after 20 minutes of pressure, and I might need stitches.",
  "Mild sore throat and runny nose since yesterday. No fever. Feeling tired but able to work.",
];

async function triage(symptoms: string) {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: TriageSchema,
    prompt: `Patient reports: ${symptoms}`,
    systemPrompt: `You are a medical triage assistant helping patients understand the urgency of their symptoms.
IMPORTANT: Always recommend professional medical care when in doubt. Never diagnose.
Add a clear disclaimer that this is not medical advice.
Be conservative — err on the side of caution.`,
    temperature: 0,
  });
  return data;
}

const urgencyColors: Record<string, string> = {
  call_911: "🔴",
  er_now: "🔴",
  urgent_care_today: "🟠",
  see_doctor_soon: "🟡",
  home_care: "🟢",
  monitor: "🟢",
};

async function main() {
  console.log("Symptom Triage Tool (DEMO ONLY — Not Medical Advice)\n");

  for (const input of patientInputs) {
    const result = await triage(input);
    const icon = urgencyColors[result.urgency] ?? "⚪";
    console.log(`Input: "${input.slice(0, 80)}..."`);
    console.log(`\n${icon} URGENCY: ${result.urgency.replace(/_/g, " ").toUpperCase()}`);
    console.log(`Reasoning: ${result.urgencyReasoning}`);

    if (result.redFlags.length > 0) {
      console.log(`\nRed Flags:`);
      result.redFlags.forEach((f) => console.log(`  ⚠ ${f}`));
    }

    console.log(`\nExtracted Symptoms:`);
    result.extractedSymptoms.forEach((s) => {
      const dur = s.duration ? ` (${s.duration})` : "";
      const sev = s.severity ? ` — ${s.severity}` : "";
      console.log(`  • ${s.symptom}${dur}${sev}`);
    });

    console.log(`\nPossible Causes:`);
    result.possibleCauses.forEach((c) => console.log(`  [${c.likelihood}] ${c.condition}`));

    if (result.homeCareTips.length > 0 && result.urgency === "home_care") {
      console.log(`\nHome Care:`);
      result.homeCareTips.forEach((t) => console.log(`  • ${t}`));
    }

    console.log(`\nWhen to escalate: ${result.whenToEscalate}`);
    console.log(`\n⚠ ${result.disclaimer}`);
    console.log("\n" + "─".repeat(60) + "\n");
  }
}

main().catch(console.error);
