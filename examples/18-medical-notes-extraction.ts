// Medical notes extraction — parse clinical notes into structured data
// Run: OPENAI_API_KEY=... npx tsx examples/18-medical-notes-extraction.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

// Note: This is for demonstration only — not for actual medical use.
const ClinicalNoteSchema = z.object({
  chiefComplaint: z.string(),
  vitals: z
    .object({
      bloodPressure: z.string().optional(),
      heartRate: z.number().optional(),
      temperature: z.object({ value: z.number(), unit: z.string() }).optional(),
      weight: z.object({ value: z.number(), unit: z.string() }).optional(),
      spo2: z.number().optional(),
    })
    .optional(),
  symptoms: z.array(
    z.object({
      name: z.string(),
      duration: z.string().optional(),
      severity: z.enum(["mild", "moderate", "severe"]).optional(),
    })
  ),
  currentMedications: z.array(
    z.object({
      name: z.string(),
      dose: z.string().optional(),
      frequency: z.string().optional(),
    })
  ),
  allergies: z.array(z.string()),
  assessment: z.string().optional(),
  plan: z.array(z.string()),
  followUp: z.string().optional(),
  icd10Codes: z.array(z.string()).optional().describe("Relevant ICD-10 codes if apparent"),
});

const clinicalNote = `
PATIENT ENCOUNTER NOTE
Date: 03/07/2024

CC: Patient presents with persistent headache and dizziness x 3 days.

VITALS: BP 148/92 mmHg, HR 88 bpm, Temp 98.6°F, Weight 185 lbs, SpO2 98%

HPI: 52-year-old male with HTN and T2DM presents with throbbing headache
(7/10 severity) that started 3 days ago. Also reports dizziness when standing.
No nausea/vomiting. No visual changes. Last took lisinopril this morning.

CURRENT MEDICATIONS:
- Lisinopril 10mg QD
- Metformin 500mg BID
- Aspirin 81mg QD

ALLERGIES: PCN (rash), Sulfa drugs

ASSESSMENT: Uncontrolled hypertension. Rule out hypertensive urgency.

PLAN:
1. Increase lisinopril to 20mg QD
2. Order BMP and CBC
3. Check BP in 1 hour; if >160/100, consider IV labetalol
4. Patient education on medication adherence
5. Low-sodium diet counseling

FOLLOW-UP: 1 week or sooner if symptoms worsen
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: ClinicalNoteSchema,
    prompt: clinicalNote,
    systemPrompt:
      "Extract structured clinical data from this medical note. Be precise with medical terminology and values.",
    temperature: 0,
  });

  console.log("Extracted clinical data:");
  console.log(`\nChief Complaint: ${data.chiefComplaint}`);

  if (data.vitals) {
    console.log("\nVitals:");
    if (data.vitals.bloodPressure) console.log(`  BP: ${data.vitals.bloodPressure}`);
    if (data.vitals.heartRate) console.log(`  HR: ${data.vitals.heartRate} bpm`);
    if (data.vitals.temperature) console.log(`  Temp: ${data.vitals.temperature.value}°${data.vitals.temperature.unit}`);
    if (data.vitals.spo2) console.log(`  SpO2: ${data.vitals.spo2}%`);
  }

  console.log(`\nSymptoms (${data.symptoms.length}):`);
  data.symptoms.forEach((s) => {
    console.log(`  • ${s.name}${s.duration ? ` (${s.duration})` : ""}${s.severity ? ` — ${s.severity}` : ""}`);
  });

  console.log(`\nMedications:`);
  data.currentMedications.forEach((m) => {
    console.log(`  • ${m.name} ${m.dose ?? ""} ${m.frequency ?? ""}`.trim());
  });

  console.log(`\nAllergies: ${data.allergies.join(", ")}`);
  console.log(`\nAssessment: ${data.assessment}`);

  console.log(`\nPlan:`);
  data.plan.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));

  console.log(`\nFollow-up: ${data.followUp}`);
  if (data.icd10Codes?.length) {
    console.log(`\nICD-10 Codes: ${data.icd10Codes.join(", ")}`);
  }
}

main().catch(console.error);
