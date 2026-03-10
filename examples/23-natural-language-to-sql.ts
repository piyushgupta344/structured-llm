// Natural language to SQL — convert plain English queries to parameterized SQL
// Run: OPENAI_API_KEY=... npx tsx examples/23-natural-language-to-sql.ts

import OpenAI from "openai";
import { z } from "zod";
import { createTemplate } from "../src/index.js";

const client = new OpenAI();

const SQLSchema = z.object({
  sql: z.string().describe("Valid parameterized SQL query"),
  params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).describe("Query parameters in order"),
  explanation: z.string().describe("Plain English explanation of what the query does"),
  tablesUsed: z.array(z.string()),
  estimatedComplexity: z.enum(["simple", "moderate", "complex"]),
  warnings: z.array(z.string()).describe("Any potential issues, e.g. missing indexes, N+1 risk"),
});

const nl2sql = createTemplate({
  template: `Database schema:
{{schema}}

User query: {{question}`,
  schema: SQLSchema,
  client,
  model: "gpt-4o-mini",
  systemPrompt: `You are an expert SQL developer. Convert natural language questions into safe, efficient SQL queries.
Rules:
- Always use parameterized queries with $1, $2, etc. (PostgreSQL style)
- Never use SELECT * — always specify columns
- Add appropriate JOINs based on the schema
- Flag potential performance issues in warnings
- Prefer CTEs over nested subqueries for readability`,
  temperature: 0,
});

const schema = `
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  plan ENUM('free', 'pro', 'enterprise') DEFAULT 'free'
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total_usd DECIMAL(10, 2),
  status ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  price_usd DECIMAL(10, 2),
  inventory_count INTEGER DEFAULT 0,
  category VARCHAR(100)
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER,
  price_usd DECIMAL(10, 2)
);
`;

const questions = [
  "Show me the top 10 customers by total spending in the last 30 days",
  "Which products are low on inventory (less than 10 in stock) and have been ordered in the past week?",
  "Find all users who signed up in 2024 but have never placed an order",
];

async function main() {
  for (const question of questions) {
    console.log(`Q: ${question}`);

    const { data } = await nl2sql.run({ schema, question });

    console.log(`\nSQL [${data.estimatedComplexity}]:`);
    console.log(data.sql.split("\n").map((l) => `  ${l}`).join("\n"));
    if (data.params.length > 0) {
      console.log(`\nParams: [${data.params.map((p) => JSON.stringify(p)).join(", ")}]`);
    }
    console.log(`\nExplanation: ${data.explanation}`);
    if (data.warnings.length > 0) {
      console.log(`Warnings: ${data.warnings.map((w) => `\n  ⚠ ${w}`).join("")}`);
    }
    console.log("\n---\n");
  }
}

main().catch(console.error);
