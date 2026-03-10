// Response caching — avoid redundant LLM calls for identical inputs
// Run: OPENAI_API_KEY=... npx tsx examples/37-caching-repeated-queries.ts

import OpenAI from "openai";
import { z } from "zod";
import { withCache } from "../src/index.js";

const client = new OpenAI();

const ClassificationSchema = z.object({
  category: z.enum(["frontend", "backend", "devops", "data", "mobile", "security", "other"]),
  primaryLanguage: z.string().optional(),
  complexity: z.enum(["beginner", "intermediate", "advanced"]),
  tags: z.array(z.string()),
});

// Create a cached version of generate with 10-minute TTL
const cachedGenerate = withCache({ ttl: 10 * 60 * 1000, debug: true });

async function classifyPost(title: string) {
  const start = Date.now();
  const result = await cachedGenerate({
    client,
    model: "gpt-4o-mini",
    schema: ClassificationSchema,
    prompt: title,
    systemPrompt: "Classify this technical blog post title.",
    temperature: 0,
  });
  const elapsed = Date.now() - start;
  return { ...result, elapsed };
}

async function main() {
  const posts = [
    "Building a Real-Time Chat App with WebSockets and Node.js",
    "Kubernetes Horizontal Pod Autoscaling in Production",
    "Building a Real-Time Chat App with WebSockets and Node.js", // duplicate
    "React Query v5: Everything You Need to Know",
    "Kubernetes Horizontal Pod Autoscaling in Production", // duplicate
    "Advanced TypeScript: Conditional Types Deep Dive",
    "React Query v5: Everything You Need to Know", // duplicate
  ];

  console.log("Classifying blog posts (duplicates will be served from cache):\n");

  for (const post of posts) {
    const result = await classifyPost(post);
    const cacheStr = result.fromCache ? " [CACHE HIT]" : " [API CALL]";
    console.log(`${cacheStr} "${post.slice(0, 55)}..." (${result.elapsed}ms)`);
    console.log(`  → ${result.data.category} | ${result.data.complexity} | ${result.data.tags.join(", ")}\n`);
  }

  const apiCalls = posts.filter((p, i) => posts.indexOf(p) === i).length;
  console.log(`Summary: ${posts.length} requests → ${apiCalls} API calls (${posts.length - apiCalls} cache hits)`);
}

main().catch(console.error);
