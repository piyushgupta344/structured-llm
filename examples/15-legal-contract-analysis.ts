// Legal contract analysis — extract key terms and flag risky clauses
// Run: OPENAI_API_KEY=... npx tsx examples/15-legal-contract-analysis.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateMultiSchema } from "../src/index.js";

const client = new OpenAI();

const KeyTermsSchema = z.object({
  parties: z.array(z.object({ name: z.string(), role: z.string() })),
  effectiveDate: z.string().optional(),
  terminationDate: z.string().optional(),
  governingLaw: z.string().optional(),
  paymentTerms: z.string().optional(),
  autoRenewal: z.boolean().optional(),
  noticePeriodDays: z.number().optional(),
});

const RiskAssessmentSchema = z.object({
  overallRisk: z.enum(["low", "medium", "high"]),
  riskScore: z.number().min(0).max(10),
  redFlags: z.array(
    z.object({
      clause: z.string(),
      severity: z.enum(["minor", "moderate", "major"]),
      explanation: z.string(),
    })
  ),
  recommendations: z.array(z.string()),
});

const contractText = `
SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of January 1, 2024,
between TechVendor Inc. ("Vendor") and ClientCorp LLC ("Client").

1. SERVICES
   Vendor shall provide software development services as outlined in Schedule A.

2. PAYMENT
   Client shall pay $15,000/month, due within 5 days of invoice. Late payments
   accrue interest at 2% per month compounded daily.

3. INTELLECTUAL PROPERTY
   All work product created under this Agreement shall be the sole property of
   Vendor until full payment is received. Client receives a non-exclusive license.

4. TERM AND TERMINATION
   This Agreement commences January 1, 2024 and automatically renews annually
   unless either party provides 90 days written notice. Early termination by
   Client requires payment of 6 months remaining fees as liquidated damages.

5. LIMITATION OF LIABILITY
   Vendor's total liability shall not exceed $500 regardless of the nature of
   the claim. Client waives all rights to consequential damages.

6. GOVERNING LAW
   This Agreement is governed by the laws of the Cayman Islands.

7. CONFIDENTIALITY
   This clause is intentionally left blank pending negotiation.
`;

async function main() {
  console.log("Analyzing contract...\n");

  const { results, totalUsage } = await generateMultiSchema({
    client,
    model: "gpt-4o-mini",
    prompt: contractText,
    systemPrompt: "You are a legal contract analyst. Be thorough and conservative in risk assessment.",
    schemas: {
      keyTerms: KeyTermsSchema,
      risks: RiskAssessmentSchema,
    },
  });

  // Key terms
  if (results.keyTerms.data) {
    const kt = results.keyTerms.data;
    console.log("Key Terms:");
    console.log(`  Parties: ${kt.parties.map((p) => `${p.name} (${p.role})`).join(", ")}`);
    console.log(`  Effective: ${kt.effectiveDate ?? "N/A"}`);
    console.log(`  Auto-renewal: ${kt.autoRenewal ? "Yes" : "No"}`);
    console.log(`  Notice period: ${kt.noticePeriodDays ?? "N/A"} days`);
    console.log(`  Governing law: ${kt.governingLaw ?? "N/A"}`);
    console.log(`  Payment terms: ${kt.paymentTerms ?? "N/A"}`);
  }

  console.log();

  // Risk assessment
  if (results.risks.data) {
    const ra = results.risks.data;
    const riskEmoji = ra.overallRisk === "high" ? "🔴" : ra.overallRisk === "medium" ? "🟡" : "🟢";
    console.log(`Risk Assessment: ${riskEmoji} ${ra.overallRisk.toUpperCase()} (${ra.riskScore}/10)`);
    console.log("\nRed Flags:");
    ra.redFlags.forEach((flag) => {
      console.log(`  [${flag.severity.toUpperCase()}] ${flag.clause}`);
      console.log(`    ${flag.explanation}`);
    });
    if (ra.recommendations.length > 0) {
      console.log("\nRecommendations:");
      ra.recommendations.forEach((rec) => console.log(`  • ${rec}`));
    }
  }

  if (totalUsage) {
    console.log(`\nTotal tokens: ${totalUsage.totalTokens} (~$${totalUsage.estimatedCostUsd.toFixed(5)})`);
  }
}

main().catch(console.error);
