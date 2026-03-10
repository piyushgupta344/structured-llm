// Log anomaly detection — analyze server logs for incidents and anomalies
// Run: OPENAI_API_KEY=... npx tsx examples/27-log-anomaly-detection.ts

import OpenAI from "openai";
import { z } from "zod";
import { generate } from "../src/index.js";

const client = new OpenAI();

const LogAnalysisSchema = z.object({
  timeRange: z.object({ start: z.string(), end: z.string() }),
  totalEvents: z.number().int(),
  hasIncident: z.boolean(),
  severity: z.enum(["ok", "warning", "error", "critical"]),
  anomalies: z.array(
    z.object({
      type: z.enum([
        "error_spike",
        "latency_spike",
        "repeated_failure",
        "auth_failure",
        "rate_limit",
        "disk_space",
        "memory_pressure",
        "unusual_traffic",
        "service_down",
        "other",
      ]),
      description: z.string(),
      affectedService: z.string().optional(),
      firstSeen: z.string().optional(),
      count: z.number().optional(),
      severity: z.enum(["warning", "error", "critical"]),
    })
  ),
  rootCause: z.string().optional().describe("Best hypothesis for the root cause if an incident is detected"),
  recommendedActions: z.array(z.string()),
  summary: z.string(),
});

const logs = `
2024-03-06 14:00:02 INFO  api-gateway   GET /api/users 200 45ms
2024-03-06 14:00:03 INFO  api-gateway   GET /api/products 200 52ms
2024-03-06 14:00:15 INFO  api-gateway   POST /api/orders 201 234ms
2024-03-06 14:01:00 INFO  api-gateway   GET /api/users 200 48ms
2024-03-06 14:02:11 WARN  db-primary    Slow query detected: 2341ms [SELECT * FROM orders]
2024-03-06 14:02:12 WARN  db-primary    Slow query detected: 3102ms [SELECT * FROM orders]
2024-03-06 14:02:12 ERROR api-gateway   POST /api/orders 500 3205ms — DB connection timeout
2024-03-06 14:02:13 ERROR api-gateway   POST /api/orders 500 3401ms — DB connection timeout
2024-03-06 14:02:13 ERROR api-gateway   GET /api/orders 500 3189ms — DB connection timeout
2024-03-06 14:02:14 ERROR api-gateway   POST /api/orders 500 3267ms — DB connection timeout
2024-03-06 14:02:14 ERROR api-gateway   POST /api/orders 500 3312ms — DB connection timeout
2024-03-06 14:02:15 ERROR worker-1      Failed to process job queue: cannot acquire DB connection (pool exhausted)
2024-03-06 14:02:15 ERROR worker-2      Failed to process job queue: cannot acquire DB connection (pool exhausted)
2024-03-06 14:02:16 ERROR api-gateway   POST /api/orders 500 3198ms — DB connection timeout
2024-03-06 14:02:16 INFO  cache         Cache hit rate: 23% (normal: ~85%) — cache appears cold
2024-03-06 14:02:30 WARN  db-primary    Connection pool at 100% capacity (20/20)
2024-03-06 14:02:31 ERROR db-primary    Unable to accept new connections: pool exhausted
2024-03-06 14:02:35 INFO  db-replica-1  Replication lag: 8.2s (normal: <0.5s)
2024-03-06 14:02:40 WARN  monitoring    CPU usage on db-primary: 94%
2024-03-06 14:03:00 ERROR api-gateway   GET /health 503 — database health check failed
`;

async function main() {
  const { data } = await generate({
    client,
    model: "gpt-4o-mini",
    schema: LogAnalysisSchema,
    prompt: logs,
    systemPrompt: `You are a senior SRE analyzing server logs for incidents and anomalies.
Identify patterns, correlate events, and provide actionable recommendations.
Be specific about timing and affected services.`,
    temperature: 0,
  });

  const icon = { ok: "✓", warning: "⚠", error: "✗", critical: "🔴" }[data.severity];
  console.log(`Status: ${icon} ${data.severity.toUpperCase()} | Incident: ${data.hasIncident ? "YES" : "No"}`);
  console.log(`Time range: ${data.timeRange.start} → ${data.timeRange.end}`);
  console.log(`Total events analyzed: ${data.totalEvents}`);

  if (data.anomalies.length > 0) {
    console.log(`\nAnomalies detected (${data.anomalies.length}):`);
    data.anomalies.forEach((a) => {
      console.log(`  [${a.severity.toUpperCase()}] ${a.type.replace(/_/g, " ")}`);
      console.log(`    ${a.description}`);
      if (a.affectedService) console.log(`    Service: ${a.affectedService}`);
      if (a.firstSeen) console.log(`    First seen: ${a.firstSeen}`);
    });
  }

  if (data.rootCause) {
    console.log(`\nRoot cause hypothesis: ${data.rootCause}`);
  }

  console.log(`\nRecommended actions:`);
  data.recommendedActions.forEach((a) => console.log(`  → ${a}`));

  console.log(`\nSummary: ${data.summary}`);
}

main().catch(console.error);
