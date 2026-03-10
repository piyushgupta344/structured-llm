// Multilingual feedback processor — normalize and analyze feedback in multiple languages
// Run: OPENAI_API_KEY=... npx tsx examples/34-multilingual-feedback.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateBatch } from "../src/index.js";

const client = new OpenAI();

const FeedbackSchema = z.object({
  originalLanguage: z.string().describe("ISO 639-1 code, e.g. 'fr', 'de', 'ja'"),
  translatedText: z.string().describe("English translation"),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  score: z.number().min(1).max(10).optional().describe("Inferred score if mentioned"),
  category: z.enum(["product", "shipping", "customer_service", "pricing", "ux", "other"]),
  topics: z.array(z.string()).describe("Specific topics mentioned"),
  urgency: z.enum(["low", "normal", "high"]).describe("Does this need immediate attention?"),
  actionRequired: z.boolean(),
  suggestedAction: z.string().optional(),
});

const feedbackItems = [
  {
    id: "FB-001",
    text: "Le produit est excellent mais la livraison a pris 3 semaines. Très déçu du service de livraison.",
    source: "France",
  },
  {
    id: "FB-002",
    text: "Das Produkt funktioniert nicht wie beschrieben. Ich möchte eine Rückerstattung. Sehr schlechte Qualität.",
    source: "Germany",
  },
  {
    id: "FB-003",
    text: "素晴らしい製品です！使いやすくて、カスタマーサービスも丁寧でした。また購入します。",
    source: "Japan",
  },
  {
    id: "FB-004",
    text: "El precio es muy alto para lo que ofrece. Hay opciones más baratas con mejor calidad.",
    source: "Spain",
  },
  {
    id: "FB-005",
    text: "Excelente atendimento! Tive um problema e a equipe resolveu em menos de 1 hora. 10/10.",
    source: "Brazil",
  },
];

async function main() {
  console.log("Processing multilingual feedback...\n");

  const { items, succeeded, totalUsage } = await generateBatch({
    client,
    model: "gpt-4o-mini",
    schema: FeedbackSchema,
    concurrency: 3,
    inputs: feedbackItems.map((item) => ({
      prompt: `Customer feedback from ${item.source}:\n\n"${item.text}"`,
      systemPrompt:
        "Analyze this customer feedback. Detect the language, translate to English, and extract structured insights.",
    })),
    onProgress: ({ completed, total }) => process.stdout.write(`\rProcessing: ${completed}/${total}`),
  });

  console.log(`\n\nProcessed ${succeeded.length}/${items.length} feedback items:\n`);

  const urgent = succeeded.filter((r) => r.data?.urgency === "high" || r.data?.actionRequired);
  if (urgent.length > 0) {
    console.log(`⚠ ${urgent.length} items require action\n`);
  }

  succeeded.forEach(({ data, index }) => {
    if (!data) return;
    const item = feedbackItems[index];
    const sentIcon = data.sentiment === "positive" ? "+" : data.sentiment === "negative" ? "-" : "~";
    console.log(`[${sentIcon}] ${item.id} (${data.originalLanguage.toUpperCase()} → ${item.source})`);
    console.log(`  Translation: "${data.translatedText.slice(0, 100)}..."`);
    console.log(`  Category: ${data.category} | Urgency: ${data.urgency}`);
    console.log(`  Topics: ${data.topics.join(", ")}`);
    if (data.actionRequired && data.suggestedAction) {
      console.log(`  → ACTION: ${data.suggestedAction}`);
    }
    console.log();
  });

  // aggregate by category
  const byCat = succeeded.reduce(
    (acc, r) => {
      if (r.data) {
        acc[r.data.category] = (acc[r.data.category] ?? 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );
  console.log("By category:", Object.entries(byCat).map(([k, v]) => `${k}: ${v}`).join(", "));

  if (totalUsage) {
    console.log(`\nTokens: ${totalUsage.totalTokens} (~$${totalUsage.estimatedCostUsd.toFixed(5)})`);
  }
}

main().catch(console.error);
