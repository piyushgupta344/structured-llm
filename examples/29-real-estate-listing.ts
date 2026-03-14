// Real estate listing parser — extract structured property data from listings
// Run: OPENAI_API_KEY=... npx tsx examples/29-real-estate-listing.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateArray } from "../src/index.js";

const client = new OpenAI();

const PropertySchema = z.object({
  address: z.string(),
  city: z.string(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  listingType: z.enum(["sale", "rent"]),
  propertyType: z.enum(["house", "condo", "apartment", "townhouse", "land", "commercial", "other"]),
  price: z.number(),
  priceUnit: z.enum(["total", "per_month"]),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  squareFeet: z.number().optional(),
  lotSize: z.string().optional(),
  yearBuilt: z.number().int().optional(),
  parking: z.string().optional(),
  amenities: z.array(z.string()),
  condition: z.enum(["new", "excellent", "good", "fair", "fixer"]).optional(),
  hoa: z.object({ amount: z.number(), frequency: z.string() }).optional(),
  highlights: z.array(z.string()).describe("Key selling points"),
  mlsId: z.string().optional(),
});

const listingsText = `
--- Listing 1 ---
Beautiful 4BR/3BA craftsman home in Palo Alto! MLS #PA2024-1123
1,842 Birchwood Ave, Palo Alto, CA 94301
Listed at $3,450,000
2,800 sqft on a 7,200 sqft lot. Built 2018, like new condition.
Features: chef's kitchen with Wolf appliances, primary suite with spa bath,
vaulted ceilings, hardwood floors throughout, solar panels, 2-car garage.
HOA: none. Top-rated PA schools district.

--- Listing 2 ---
Modern 1BR/1BA condo for rent — San Francisco Financial District
425 Beale St #18C, SF, CA 94105
$3,200/month (utilities included)
Built 2020, 750 sqft, 33rd floor, panoramic bay views.
In-unit W/D, Nest thermostat, floor-to-ceiling windows.
Building amenities: 24hr doorman, rooftop deck, gym, bike storage.
HOA paid by owner. 1 assigned parking spot in secured garage.
Pets OK (1 cat or 1 dog up to 25 lbs).

--- Listing 3 ---
PRICE REDUCED! Fixer opportunity — invest & renovate
892 Maple St, Oakland, CA 94607
$489,000 | 3 beds, 1 bath, 1,100 sqft | Built 1948
As-is sale. Property needs significant work: roof (2018), updated electrical,
cosmetic repairs throughout. Large backyard (4,500 sqft lot).
Cash or renovation loan preferred. No HOA. Great investment potential.
`;

async function main() {
  const { data, usage } = await generateArray({
    client,
    model: "gpt-4o-mini",
    schema: PropertySchema,
    prompt: listingsText,
    systemPrompt: "Extract each property listing as a separate structured item. Parse all numerical values accurately.",
    trackUsage: true,
  });

  console.log(`Parsed ${data.length} listings:\n`);
  data.forEach((prop, i) => {
    const priceStr =
      prop.priceUnit === "per_month"
        ? `$${prop.price.toLocaleString()}/mo`
        : `$${prop.price.toLocaleString()}`;
    console.log(`[${i + 1}] ${prop.propertyType.toUpperCase()} for ${prop.listingType.toUpperCase()}`);
    console.log(`    ${prop.address}, ${prop.city}, ${prop.state ?? ""}`);
    console.log(`    Price: ${priceStr}`);
    const details = [
      prop.bedrooms ? `${prop.bedrooms}BR` : null,
      prop.bathrooms ? `${prop.bathrooms}BA` : null,
      prop.squareFeet ? `${prop.squareFeet.toLocaleString()} sqft` : null,
      prop.yearBuilt ? `built ${prop.yearBuilt}` : null,
      prop.condition ? prop.condition : null,
    ].filter(Boolean);
    if (details.length) console.log(`    ${details.join(" | ")}`);
    if (prop.hoa) console.log(`    HOA: $${prop.hoa.amount}/${prop.hoa.frequency}`);
    console.log(`    Highlights: ${prop.highlights.slice(0, 3).join(", ")}`);
    console.log();
  });

  if (usage) {
    console.log(`Tokens: ${usage.totalTokens} (~$${usage.estimatedCostUsd?.toFixed(5) ?? "n/a"})`);
  }
}

main().catch(console.error);
