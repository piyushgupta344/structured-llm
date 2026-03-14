// Resume parsing — extract structured data from a resume/CV
// Run: OPENAI_API_KEY=... npx tsx examples/11-resume-parsing.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const ResumeSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  experience: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      startDate: z.string(),
      endDate: z.string().optional(), // null = current
      description: z.string().optional(),
      technologies: z.array(z.string()).optional(),
    })
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string().optional(),
      graduationYear: z.number().int().optional(),
    })
  ),
  skills: z.array(z.string()),
  languages: z.array(z.object({ name: z.string(), level: z.string() })).optional(),
});

const sampleResume = `
John Doe
john.doe@example.com | +1 (555) 123-4567 | San Francisco, CA

SUMMARY
Full-stack engineer with 6 years of experience building scalable web apps.
Passionate about developer tooling and open source.

EXPERIENCE
Senior Software Engineer — Acme Corp (Jan 2021 – Present)
  • Led migration from monolith to microservices, reducing deploy time by 60%
  • Technologies: TypeScript, Node.js, Kubernetes, PostgreSQL, Redis

Software Engineer — Beta Systems (Mar 2018 – Dec 2020)
  • Built real-time analytics dashboard serving 50k DAU
  • Technologies: React, GraphQL, Python, AWS

EDUCATION
B.S. Computer Science — Stanford University, 2018

SKILLS
TypeScript, JavaScript, Python, Go, React, Node.js, PostgreSQL, Redis, Docker, Kubernetes

LANGUAGES
English (Native), Spanish (Intermediate)
`;

async function main() {
  const { data, usage } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: ResumeSchema,
    prompt: sampleResume,
    systemPrompt: "Extract all structured information from this resume. Be precise with dates.",
    trackUsage: true,
  });

  console.log("Parsed resume:");
  console.log(`  Name: ${data.name}`);
  console.log(`  Email: ${data.email}`);
  console.log(`  Location: ${data.location}`);
  console.log(`  Experience: ${data.experience.length} positions`);
  data.experience.forEach((e) => {
    console.log(`    - ${e.title} at ${e.company} (${e.startDate} – ${e.endDate ?? "present"})`);
    if (e.technologies?.length) console.log(`      Tech: ${e.technologies.join(", ")}`);
  });
  console.log(`  Skills: ${data.skills.slice(0, 5).join(", ")}...`);
  console.log(`  Languages: ${data.languages?.map((l) => `${l.name} (${l.level})`).join(", ")}`);
  if (usage) console.log(`\nTokens used: ${usage.totalTokens} (~$${usage.estimatedCostUsd?.toFixed(5) ?? "n/a"})`);
}

main().catch(console.error);
