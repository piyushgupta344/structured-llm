// Product catalog normalization — standardize messy product data from multiple sources
// Run: OPENAI_API_KEY=... npx tsx examples/17-product-catalog-normalization.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateBatch } from "../src/index.js";

const client = new OpenAI();

const ProductSchema = z.object({
  name: z.string(),
  brand: z.string().optional(),
  category: z.enum([
    "electronics",
    "clothing",
    "food",
    "home",
    "sports",
    "beauty",
    "books",
    "toys",
    "other",
  ]),
  price: z.number().optional(),
  currency: z.string().default("USD"),
  sku: z.string().optional(),
  color: z.string().optional(),
  size: z.string().optional(),
  weight: z.object({ value: z.number(), unit: z.string() }).optional(),
  tags: z.array(z.string()),
  normalizedName: z.string().describe("Clean, standardized product name"),
});

// Messy product data from different suppliers
const rawProducts = [
  `SKU: GX-4291-BLK / Nike running shoe men sz 10.5 US / black-white / $89.99 / wt: 280g`,
  `sony wh-1000xm5 headphones wireless nc blk - 30hr bat - USD 349`,
  `ORGANIC WHOLE MILK 1 GALLON (128 FL OZ) - GRASS FED - Horizon Brand - $6.49`,
  `iphone case 14 pro max clear magsafe compatible apple`,
  `Vintage Levi's 501 Jeans W32 L30 - Medium Wash - Great Condition`,
];

async function main() {
  console.log("Normalizing product catalog entries...\n");

  const { items, succeeded, failed, totalUsage } = await generateBatch({
    client,
    model: "gpt-4o-mini",
    schema: ProductSchema,
    concurrency: 3,
    inputs: rawProducts.map((raw) => ({
      prompt: raw,
      systemPrompt:
        "Normalize this product listing into a structured format. Infer missing fields where possible.",
    })),
    onProgress: ({ completed, total }) => {
      process.stdout.write(`\rProcessing: ${completed}/${total}`);
    },
  });

  console.log(`\n\nNormalized ${succeeded.length}/${items.length} products:`);
  succeeded.forEach(({ data, index }) => {
    if (!data) return;
    console.log(`\n[${index + 1}] ${data.normalizedName}`);
    console.log(`  Brand: ${data.brand ?? "unknown"} | Category: ${data.category}`);
    if (data.price) console.log(`  Price: ${data.currency} ${data.price}`);
    if (data.color) console.log(`  Color: ${data.color}`);
    if (data.size) console.log(`  Size: ${data.size}`);
    if (data.weight) console.log(`  Weight: ${data.weight.value}${data.weight.unit}`);
    console.log(`  Tags: ${data.tags.join(", ")}`);
  });

  if (failed.length > 0) {
    console.log(`\nFailed to process ${failed.length} items`);
  }

  if (totalUsage) {
    console.log(`\nTotal tokens: ${totalUsage.totalTokens} | Cost: ~$${totalUsage.estimatedCostUsd.toFixed(5)}`);
  }
}

main().catch(console.error);
