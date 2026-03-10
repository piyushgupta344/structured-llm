// Job posting skills extractor — pull required/preferred skills from job descriptions
// Run: OPENAI_API_KEY=... npx tsx examples/19-job-posting-skills.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const JobPostingSchema = z.object({
  title: z.string(),
  company: z.string().optional(),
  seniorityLevel: z.enum(["intern", "junior", "mid", "senior", "staff", "principal", "manager", "director"]).optional(),
  remote: z.enum(["remote", "hybrid", "onsite", "unspecified"]),
  requiredSkills: z.array(
    z.object({
      skill: z.string(),
      category: z.enum(["language", "framework", "tool", "platform", "methodology", "soft_skill", "other"]),
      yearsRequired: z.number().optional(),
    })
  ),
  preferredSkills: z.array(z.string()),
  compensationRange: z
    .object({
      min: z.number(),
      max: z.number(),
      currency: z.string(),
      period: z.enum(["hourly", "monthly", "annual"]),
    })
    .optional(),
  benefits: z.array(z.string()),
  responsibilities: z.array(z.string()),
  techStack: z.array(z.string()).describe("Flattened list of all technologies mentioned"),
});

const jobPosting = `
Senior Full-Stack Engineer — Remote

About the Role:
We're looking for a Senior Full-Stack Engineer to join our 20-person product team.
You'll own features end-to-end and help shape our technical direction.

Requirements:
• 5+ years of professional software development experience
• Strong proficiency in TypeScript and React (hooks, context, performance optimization)
• Backend experience with Node.js and one of: PostgreSQL, MySQL, or MongoDB
• Experience with cloud platforms (AWS preferred; GCP/Azure acceptable)
• Familiarity with CI/CD pipelines (GitHub Actions, CircleCI)
• Strong understanding of REST API design and GraphQL
• Experience with containerization (Docker, Kubernetes)

Preferred:
• Experience with Redis or other caching layers
• Knowledge of web security best practices (OWASP)
• Open source contributions
• Experience with Next.js or Remix

Responsibilities:
- Design, build, and maintain customer-facing features
- Write thorough tests (unit, integration, E2E with Playwright)
- Participate in code reviews and technical design discussions
- Mentor junior engineers

Compensation: $150,000 - $200,000/year + equity
Benefits: 100% remote, unlimited PTO, $3k/yr learning budget, health/dental/vision
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: JobPostingSchema,
    prompt: jobPosting,
    systemPrompt: "Parse this job posting and extract all structured information accurately.",
  });

  console.log(`Role: ${data.title}`);
  console.log(`Level: ${data.seniorityLevel ?? "unspecified"} | Remote: ${data.remote}`);

  if (data.compensationRange) {
    const c = data.compensationRange;
    console.log(`Compensation: $${c.min.toLocaleString()} - $${c.max.toLocaleString()} ${c.currency}/${c.period}`);
  }

  console.log(`\nRequired Skills (${data.requiredSkills.length}):`);
  const byCategory = data.requiredSkills.reduce(
    (acc, s) => {
      (acc[s.category] ??= []).push(s.skill);
      return acc;
    },
    {} as Record<string, string[]>
  );
  Object.entries(byCategory).forEach(([cat, skills]) => {
    console.log(`  ${cat}: ${skills.join(", ")}`);
  });

  console.log(`\nPreferred: ${data.preferredSkills.join(", ")}`);
  console.log(`\nFull tech stack: ${data.techStack.join(", ")}`);
  console.log(`\nBenefits:`);
  data.benefits.forEach((b) => console.log(`  • ${b}`));
}

main().catch(console.error);
