"use client";

import { useState } from "react";

const demos = [
  {
    id: "analyze",
    label: "analyze()",
    description: "Sentiment, key points, and topics from any text",
    defaultInput: "The new MacBook Pro with M4 is a game changer for developers. The performance is incredible, battery lasts all day, and the display is gorgeous. Only downside is the price — it's not cheap.",
    endpoint: "/api/analyze",
    buildBody: (text: string) => ({ text }),
  },
  {
    id: "classify",
    label: "classify()",
    description: "Route support tickets to the right team",
    defaultInput: "My payment was declined but I can see the charge on my bank statement.",
    endpoint: "/api/classify",
    buildBody: (text: string) => ({
      text,
      categories: ["billing", "auth", "bug", "feature-request", "general"],
    }),
  },
  {
    id: "extract",
    label: "extract()",
    description: "Pull structured fields from unstructured text",
    defaultInput: "Invoice #INV-2024-001 from Acme Corp. Total: $2,450.00. Due date: April 15, 2024. Contact: billing@acme.com",
    endpoint: "/api/extract",
    buildBody: (text: string) => ({
      text,
      fields: {
        invoiceNumber: "string",
        vendor: "string",
        amount: "number",
        dueDate: "date",
        email: "email",
      },
    }),
  },
];

export default function Page() {
  const [activeDemo, setActiveDemo] = useState(demos[0]);
  const [input, setInput] = useState(demos[0].defaultInput);
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchDemo(demo: typeof demos[0]) {
    setActiveDemo(demo);
    setInput(demo.defaultInput);
    setResult(null);
    setError(null);
  }

  async function runDemo() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(activeDemo.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeDemo.buildBody(input)),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setLoading(false);
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "0.25rem" }}>
        structured-llm starter
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Typed structured output from any LLM.{" "}
        <a href="https://github.com/piyushgupta53/structured-llm" style={{ color: "#7c3aed" }}>
          GitHub →
        </a>
      </p>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "1.5rem" }}>
        {demos.map((d) => (
          <button
            key={d.id}
            onClick={() => switchDemo(d)}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontFamily: "monospace",
              fontWeight: 600,
              background: activeDemo.id === d.id ? "#7c3aed" : "#f3f4f6",
              color: activeDemo.id === d.id ? "white" : "#374151",
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      <p style={{ color: "#555", marginBottom: "1rem" }}>{activeDemo.description}</p>

      {/* Input */}
      <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>Input text</label>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "6px",
          border: "1px solid #d1d5db",
          fontFamily: "system-ui",
          fontSize: "0.95rem",
          boxSizing: "border-box",
          marginBottom: "1rem",
        }}
      />

      <button
        onClick={runDemo}
        disabled={loading}
        style={{
          padding: "10px 24px",
          background: loading ? "#9ca3af" : "#7c3aed",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: loading ? "default" : "pointer",
          fontWeight: 600,
          fontSize: "1rem",
        }}
      >
        {loading ? "Running..." : "Run ▶"}
      </button>

      {/* Error */}
      {error && (
        <div style={{ marginTop: "1rem", padding: "12px", background: "#fef2f2", borderRadius: "6px", color: "#991b1b", border: "1px solid #fca5a5" }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: "1.5rem" }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "6px" }}>Result</label>
          <pre
            style={{
              background: "#1e1e2e",
              color: "#cdd6f4",
              padding: "16px",
              borderRadius: "8px",
              overflow: "auto",
              fontSize: "0.88rem",
              lineHeight: 1.6,
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {/* Footer */}
      <footer style={{ marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #e5e7eb", color: "#9ca3af", fontSize: "0.85rem" }}>
        API routes: <code>/api/analyze</code> · <code>/api/classify</code> · <code>/api/extract</code> · <code>/api/stream</code>
      </footer>
    </main>
  );
}
