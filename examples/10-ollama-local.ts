/**
 * Example: Using local models with Ollama (zero API cost)
 *
 * Requires Ollama running locally: https://ollama.ai
 * Install models: ollama pull llama3.2 && ollama pull qwen2.5
 *
 * Run: npx tsx examples/10-ollama-local.ts
 */

import OpenAI from "openai";
import { z } from "zod";
import { generate, createClient } from "../src/index.js";

// Ollama speaks the OpenAI API format — just point to localhost
const ollamaClient = new OpenAI({
  apiKey: "ollama",
  baseURL: "http://localhost:11434/v1",
});

const CodeReviewSchema = z.object({
  summary: z.string().describe("One sentence summary of the code"),
  issues: z.array(
    z.object({
      type: z.enum(["bug", "performance", "security", "style", "logic"]),
      severity: z.enum(["critical", "high", "medium", "low"]),
      line: z.number().optional(),
      description: z.string(),
      suggestion: z.string(),
    })
  ),
  overallRating: z.number().min(1).max(10),
  approved: z.boolean(),
});

const codeSnippet = `
function processUserData(userData) {
  const query = "SELECT * FROM users WHERE id = " + userData.id;
  db.query(query, function(err, results) {
    if (err) console.log(err);
    for (var i = 0; i < results.length; i++) {
      var user = results[i];
      sendEmail(user.email, "Your data: " + JSON.stringify(user));
    }
  });
}
`;

async function reviewCodeLocally() {
  console.log("Running code review with local Ollama model...\n");
  console.log("Code to review:");
  console.log(codeSnippet);

  try {
    const { data } = await generate({
      client: ollamaClient,
      model: "llama3.2",
      schema: CodeReviewSchema,
      prompt: `Review this JavaScript code and identify all issues:\n\`\`\`javascript${codeSnippet}\`\`\``,
      systemPrompt: "You are an experienced software engineer performing a code review. Be thorough.",
      mode: "json-mode", // llama3.2 handles json mode well
      maxRetries: 3,
      temperature: 0,
    });

    console.log(`\nSummary: ${data.summary}`);
    console.log(`Rating: ${data.overallRating}/10 | ${data.approved ? "APPROVED" : "CHANGES REQUESTED"}\n`);

    if (data.issues.length === 0) {
      console.log("No issues found.");
    } else {
      console.log(`Issues found (${data.issues.length}):`);
      for (const issue of data.issues.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      })) {
        console.log(`  [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.description}`);
        console.log(`         Fix: ${issue.suggestion}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("ECONNREFUSED")) {
      console.log("Ollama is not running. Start it with: ollama serve");
    } else {
      throw err;
    }
  }
}

// You can also use createClient for convenience
const llm = createClient({
  client: ollamaClient,
  model: "qwen2.5",
  defaultOptions: {
    mode: "json-mode",
    temperature: 0,
    maxRetries: 2,
  },
});

reviewCodeLocally().catch(console.error);
