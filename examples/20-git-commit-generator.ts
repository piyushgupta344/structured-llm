// Git commit message generator — create conventional commits from a diff
// Run: OPENAI_API_KEY=... npx tsx examples/20-git-commit-generator.ts

import OpenAI from "openai";
import { z } from "zod";
import { createTemplate } from "../src/index.js";

const client = new OpenAI();

const CommitSchema = z.object({
  type: z.enum(["feat", "fix", "refactor", "perf", "test", "docs", "style", "chore", "ci", "build"]),
  scope: z.string().optional(),
  description: z.string().max(72).describe("Imperative mood, max 72 chars"),
  body: z.string().optional().describe("Optional detailed explanation"),
  breakingChange: z.boolean(),
  breakingChangeDescription: z.string().optional(),
  issueRefs: z.array(z.string()).describe("e.g. ['#123', 'closes #456']"),
  fullMessage: z.string().describe("Complete formatted commit message"),
});

const commitGenerator = createTemplate({
  template: `Generate a conventional commit message for the following git diff.

File changed: {{filename}}
Branch: {{branch}}

Diff:
\`\`\`diff
{{diff}}
\`\`\``,
  schema: CommitSchema,
  client,
  model: "gpt-4o-mini",
  systemPrompt: `You are an expert at writing clean, descriptive git commit messages following the Conventional Commits specification.
Rules:
- Use imperative mood ("add" not "adds", "fix" not "fixed")
- Keep the description under 72 characters
- Only include a body if the change needs explanation
- Detect breaking changes from the diff`,
  temperature: 0.2,
});

const exampleDiffs = [
  {
    filename: "src/auth/middleware.ts",
    branch: "feat/jwt-refresh",
    diff: `
@@ -12,8 +12,25 @@ export async function authMiddleware(req, res, next) {
-  const token = req.headers.authorization?.split(' ')[1];
-  if (!token) return res.status(401).json({ error: 'Unauthorized' });
-  const user = jwt.verify(token, process.env.JWT_SECRET);
-  req.user = user;
-  next();
+  const accessToken = req.headers.authorization?.split(' ')[1];
+  const refreshToken = req.cookies?.refresh_token;
+
+  if (!accessToken) return res.status(401).json({ error: 'Unauthorized' });
+
+  try {
+    const user = jwt.verify(accessToken, process.env.JWT_SECRET);
+    req.user = user;
+    return next();
+  } catch (err) {
+    if (err.name !== 'TokenExpiredError' || !refreshToken) {
+      return res.status(401).json({ error: 'Token invalid' });
+    }
+    // attempt refresh
+    const newToken = await refreshAccessToken(refreshToken);
+    res.setHeader('X-New-Token', newToken);
+    req.user = jwt.verify(newToken, process.env.JWT_SECRET);
+    next();
+  }
 }`,
  },
  {
    filename: "src/db/queries.ts",
    branch: "perf/optimize-user-lookup",
    diff: `
@@ -5,7 +5,7 @@ export async function getUserById(id: string) {
-  return db.query('SELECT * FROM users WHERE id = $1', [id]);
+  return db.query('SELECT id, email, name, role FROM users WHERE id = $1 LIMIT 1', [id]);
 }`,
  },
];

async function main() {
  for (const example of exampleDiffs) {
    const { data } = await commitGenerator.run(example);

    console.log(`File: ${example.filename}`);
    console.log(`\nGenerated commit:`);
    console.log(`  Type:  ${data.type}${data.scope ? `(${data.scope})` : ""}`);
    console.log(`  Desc:  ${data.description}`);
    if (data.body) console.log(`  Body:  ${data.body}`);
    if (data.breakingChange) console.log(`  BREAKING CHANGE: ${data.breakingChangeDescription}`);
    if (data.issueRefs.length) console.log(`  Refs:  ${data.issueRefs.join(", ")}`);
    console.log(`\n  Full message:\n${data.fullMessage.split("\n").map((l) => `    ${l}`).join("\n")}`);
    console.log("\n---\n");
  }
}

main().catch(console.error);
