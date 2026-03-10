// Code security audit — analyze code snippets for vulnerabilities
// Run: OPENAI_API_KEY=... npx tsx examples/16-code-security-audit.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const AuditSchema = z.object({
  safe: z.boolean(),
  vulnerabilities: z.array(
    z.object({
      type: z.enum([
        "sql_injection",
        "xss",
        "command_injection",
        "path_traversal",
        "insecure_deserialization",
        "sensitive_data_exposure",
        "broken_auth",
        "idor",
        "ssrf",
        "other",
      ]),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      line: z.number().optional(),
      description: z.string(),
      fix: z.string(),
    })
  ),
  secureVersion: z.string().optional().describe("Rewritten secure version of the code if fixes are straightforward"),
});

const codeSnippets = [
  {
    lang: "JavaScript (Express)",
    code: `
app.get('/user', async (req, res) => {
  const id = req.query.id;
  const user = await db.query('SELECT * FROM users WHERE id = ' + id);
  res.json(user);
});`,
  },
  {
    lang: "Python (Flask)",
    code: `
@app.route('/ping')
def ping():
    host = request.args.get('host', 'google.com')
    result = os.system(f'ping -c 1 {host}')
    return str(result)`,
  },
  {
    lang: "JavaScript (React)",
    code: `
function Comment({ text }) {
  return <div dangerouslySetInnerHTML={{ __html: text }} />;
}`,
  },
];

async function auditCode(snippet: (typeof codeSnippets)[0]) {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: AuditSchema,
    prompt: `Language: ${snippet.lang}\n\nCode:\n\`\`\`\n${snippet.code}\n\`\`\``,
    systemPrompt: `You are a senior application security engineer. Analyze the code for security vulnerabilities.
Be specific about the issue, explain the attack vector, and provide a concrete fix.`,
    temperature: 0,
  });
  return data;
}

async function main() {
  console.log("Running security audit...\n");

  for (const snippet of codeSnippets) {
    const result = await auditCode(snippet);
    const status = result.safe ? "✓ SAFE" : "✗ VULNERABLE";
    console.log(`[${status}] ${snippet.lang}`);

    if (result.vulnerabilities.length === 0) {
      console.log("  No vulnerabilities found.");
    } else {
      for (const vuln of result.vulnerabilities) {
        console.log(`  [${vuln.severity.toUpperCase()}] ${vuln.type.replace(/_/g, " ")}`);
        console.log(`    Issue: ${vuln.description}`);
        console.log(`    Fix:   ${vuln.fix}`);
      }
    }

    if (result.secureVersion) {
      console.log(`\n  Secure version:`);
      console.log(result.secureVersion.split("\n").map((l) => `    ${l}`).join("\n"));
    }
    console.log();
  }
}

main().catch(console.error);
