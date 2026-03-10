/**
 * Example: Extract arrays of structured items
 *
 * Perfect for: bulk extraction, parsing tables/lists from documents,
 * generating collections of related items.
 *
 * Run: OPENAI_API_KEY=sk-... npx tsx examples/06-generate-array.ts
 */

import OpenAI from "openai";
import { z } from "zod";
import { generateArray } from "../src/index.js";

const TransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number().describe("Positive for credits, negative for debits"),
  category: z.enum([
    "food",
    "transport",
    "shopping",
    "utilities",
    "entertainment",
    "income",
    "other",
  ]),
  merchant: z.string().optional(),
});

const bankStatement = `
Account Statement - October 2025

10/01  PAYROLL DEPOSIT ACME CORP          +4,250.00
10/02  WHOLE FOODS MARKET 042             -127.43
10/03  NETFLIX SUBSCRIPTION               -15.99
10/03  UBER TRIP                          -23.50
10/05  AMAZON.COM PURCHASE               -89.99
10/07  SHELL GAS STATION                  -54.20
10/10  SPOTIFY PREMIUM                    -9.99
10/11  RESTAURANT LA MAISON              -142.00
10/12  METRO TRANSIT MONTHLY PASS        -112.00
10/15  FREELANCE PAYMENT - INVOICE #142  +800.00
10/18  TARGET STORES                      -67.33
10/20  ELECTRIC BILL - CITY POWER         -88.54
10/22  CVS PHARMACY                       -32.17
10/25  CHIPOTLE MEXICAN GRILL             -18.75
10/28  AMAZON PRIME ANNUAL               -139.00
10/30  ATM WITHDRAWAL                    -200.00
`;

const openai = new OpenAI();

async function parseTransactions() {
  console.log("Parsing bank statement transactions...\n");

  const { data: transactions, usage } = await generateArray({
    client: openai,
    model: "gpt-4o-mini",
    schema: TransactionSchema,
    prompt: `Extract all transactions from this bank statement:\n\n${bankStatement}`,
    systemPrompt: "Extract each transaction as a separate item. Amounts should be positive for income/credits and negative for debits.",
    trackUsage: true,
  });

  console.log(`Found ${transactions.length} transactions\n`);

  // Group by category
  const byCategory = transactions.reduce<Record<string, typeof transactions>>((acc, t) => {
    acc[t.category] = [...(acc[t.category] ?? []), t];
    return acc;
  }, {});

  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  console.log(`Total income:   $${totalIncome.toFixed(2)}`);
  console.log(`Total expenses: $${Math.abs(totalExpenses).toFixed(2)}`);
  console.log(`Net:            $${(totalIncome + totalExpenses).toFixed(2)}\n`);

  for (const [category, items] of Object.entries(byCategory)) {
    const categoryTotal = items.reduce((s, t) => s + t.amount, 0);
    console.log(`${category.padEnd(14)} ${items.length} transactions  $${Math.abs(categoryTotal).toFixed(2)}`);
  }

  if (usage) {
    console.log(`\nTokens used: ${usage.totalTokens}`);
  }
}

parseTransactions().catch(console.error);
