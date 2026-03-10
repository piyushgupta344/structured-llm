// Test case generator — generate unit tests from function signatures and docstrings
// Run: OPENAI_API_KEY=... npx tsx examples/36-test-generation.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const TestSuiteSchema = z.object({
  suiteName: z.string(),
  testFramework: z.enum(["vitest", "jest", "mocha"]),
  imports: z.array(z.string()).describe("Import statements needed"),
  tests: z.array(
    z.object({
      name: z.string(),
      category: z.enum(["happy_path", "edge_case", "error_handling", "boundary", "regression"]),
      description: z.string(),
      code: z.string().describe("Complete test case code including expect statements"),
      mocks: z.array(z.string()).describe("Any mocks or stubs needed"),
    })
  ),
  coverageGoal: z.number().min(0).max(100).describe("Estimated line coverage achieved"),
  missingCoverage: z.array(z.string()).describe("Scenarios not covered that should be tested manually"),
});

const functionToTest = `
/**
 * Calculates compound interest and returns an amortization schedule.
 * @param principal - Initial loan or investment amount in USD
 * @param annualRate - Annual interest rate as a decimal (e.g., 0.05 for 5%)
 * @param years - Number of years
 * @param compoundsPerYear - How often interest compounds (12 = monthly, 365 = daily)
 * @returns Object with finalAmount, totalInterest, and monthly breakdown
 * @throws Error if principal <= 0, annualRate < 0, years <= 0
 */
export function calculateCompoundInterest(
  principal: number,
  annualRate: number,
  years: number,
  compoundsPerYear: number = 12
): {
  finalAmount: number;
  totalInterest: number;
  schedule: Array<{ period: number; balance: number; interestEarned: number }>;
} {
  if (principal <= 0) throw new Error("Principal must be positive");
  if (annualRate < 0) throw new Error("Rate cannot be negative");
  if (years <= 0) throw new Error("Years must be positive");
  if (compoundsPerYear < 1) throw new Error("Must compound at least once per year");

  const ratePerPeriod = annualRate / compoundsPerYear;
  const totalPeriods = years * compoundsPerYear;
  const schedule = [];
  let balance = principal;

  for (let i = 1; i <= totalPeriods; i++) {
    const interestEarned = balance * ratePerPeriod;
    balance += interestEarned;
    schedule.push({ period: i, balance: Math.round(balance * 100) / 100, interestEarned: Math.round(interestEarned * 100) / 100 });
  }

  const finalAmount = Math.round(balance * 100) / 100;
  return { finalAmount, totalInterest: Math.round((finalAmount - principal) * 100) / 100, schedule };
}
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: TestSuiteSchema,
    prompt: functionToTest,
    systemPrompt: `You are a senior engineer writing thorough unit tests.
Generate comprehensive tests that cover happy paths, edge cases, and error conditions.
Use vitest syntax. Tests should be self-contained and not call real APIs.
Include precise expected values in assertions.`,
    temperature: 0.2,
  });

  console.log(`Test Suite: ${data.suiteName} (${data.testFramework})`);
  console.log(`Coverage goal: ~${data.coverageGoal}%`);
  console.log(`Tests: ${data.tests.length}\n`);

  // Print imports
  console.log("// Imports:");
  data.imports.forEach((imp) => console.log(imp));

  console.log();

  // Print each test
  data.tests.forEach((test) => {
    console.log(`// [${test.category}] ${test.name}`);
    console.log(`// ${test.description}`);
    console.log(test.code);
    console.log();
  });

  if (data.missingCoverage.length > 0) {
    console.log("// TODO — additional coverage needed:");
    data.missingCoverage.forEach((m) => console.log(`// - ${m}`));
  }
}

main().catch(console.error);
