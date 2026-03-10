// Sales call CRM updater — extract CRM-ready data from call transcripts
// Run: OPENAI_API_KEY=... npx tsx examples/26-sales-call-crm.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const SalesCallSchema = z.object({
  prospectName: z.string(),
  prospectTitle: z.string().optional(),
  prospectCompany: z.string().optional(),
  callDate: z.string().optional(),
  duration: z.string().optional(),
  dealStage: z.enum(["discovery", "qualification", "demo", "proposal", "negotiation", "closed_won", "closed_lost"]),
  budget: z.object({
    mentioned: z.boolean(),
    range: z.string().optional(),
    currency: z.string().optional(),
  }),
  painPoints: z.array(z.string()),
  competitorsConsidered: z.array(z.string()),
  decisionMakers: z.array(
    z.object({
      name: z.string().optional(),
      title: z.string(),
      involved: z.boolean(),
    })
  ),
  timeline: z.string().optional().describe("Expected decision/purchase timeline"),
  nextSteps: z.array(
    z.object({
      action: z.string(),
      owner: z.enum(["us", "prospect", "both"]),
      dueDate: z.string().optional(),
    })
  ),
  objections: z.array(
    z.object({
      objection: z.string(),
      handled: z.boolean(),
      response: z.string().optional(),
    })
  ),
  dealScore: z.number().min(0).max(10).describe("Probability of closing (0-10)"),
  callNotes: z.string().describe("2-3 sentence summary for CRM notes field"),
});

const transcript = `
Sales Call — March 6, 2024
Rep: Alex Kumar | Prospect: Maria Santos, VP of Operations, GlobalShip Logistics

Alex: Thanks for making time, Maria. You mentioned you're looking at automation tools?

Maria: Yeah, we're drowning in manual data entry. Our ops team spends about 30 hours a
week just copying data between our WMS and ERP. It's killing productivity.

Alex: That sounds painful. What systems are you currently using?

Maria: We're on SAP for ERP and a custom warehouse system. We looked at MuleSoft last
year but it was way too expensive for us.

Alex: Budget-wise, what range are you thinking for this kind of solution?

Maria: We're thinking somewhere in the $50-80k range annually. Though the CFO is
still involved and might push back.

Alex: Who else would be in the final decision?

Maria: Me, our CTO (David Park), and the CFO. David is technical and will want to
see documentation and maybe a proof of concept.

Alex: We can definitely do a POC. What's your timeline for a decision?

Maria: Ideally Q2 — we have a board review in June and want something implemented by then.

Alex: One concern I want to address — our platform has native SAP connectors, so the
integration is much simpler than MuleSoft's approach.

Maria: That's good to hear. My concern is still the implementation timeline. How long
does it typically take?

Alex: For your use case, 6-8 weeks to fully live. We can start with just the critical
data flows in week 1.

Maria: Interesting. What would be the next step?

Alex: I'd like to set up a 45-min technical demo with you and David. I'll also send
over our SAP integration documentation today.

Maria: Perfect. Let's do the demo next Thursday.
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: SalesCallSchema,
    prompt: transcript,
    systemPrompt:
      "You are a CRM analyst extracting structured sales intelligence from a call transcript. Be precise.",
    temperature: 0,
  });

  console.log(`Prospect: ${data.prospectName}, ${data.prospectTitle ?? ""} @ ${data.prospectCompany ?? "Unknown"}`);
  console.log(`Stage: ${data.dealStage} | Deal Score: ${data.dealScore}/10`);
  console.log(`Timeline: ${data.timeline ?? "Not specified"}`);

  if (data.budget.mentioned) {
    console.log(`Budget: ${data.budget.range ?? "mentioned but not specified"}`);
  }

  console.log(`\nPain Points:`);
  data.painPoints.forEach((p) => console.log(`  • ${p}`));

  if (data.competitorsConsidered.length) {
    console.log(`\nCompetitors: ${data.competitorsConsidered.join(", ")}`);
  }

  console.log(`\nDecision Makers:`);
  data.decisionMakers.forEach((dm) => {
    console.log(`  • ${dm.name ?? "Unknown"} (${dm.title}) — ${dm.involved ? "in loop" : "not yet engaged"}`);
  });

  if (data.objections.length) {
    console.log(`\nObjections:`);
    data.objections.forEach((o) => {
      console.log(`  [${o.handled ? "handled" : "open"}] ${o.objection}`);
      if (o.response) console.log(`    → ${o.response}`);
    });
  }

  console.log(`\nNext Steps:`);
  data.nextSteps.forEach((ns) => {
    console.log(`  [${ns.owner}] ${ns.action}${ns.dueDate ? ` — ${ns.dueDate}` : ""}`);
  });

  console.log(`\nCRM Notes: ${data.callNotes}`);
}

main().catch(console.error);
