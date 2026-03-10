# Examples

40 runnable examples covering real-world use cases. Clone the repo and run any of them:

```bash
git clone https://github.com/piyushgupta344/structured-llm
cd structured-llm && pnpm install
OPENAI_API_KEY=sk-... npx tsx examples/11-resume-parsing.ts
```

## Document processing

| Example | What it does |
|---|---|
| [11 — Resume parsing](https://github.com/piyushgupta344/structured-llm/blob/main/examples/11-resume-parsing.ts) | Extract experience, skills, education from a CV |
| [12 — Invoice extraction](https://github.com/piyushgupta344/structured-llm/blob/main/examples/12-invoice-extraction.ts) | `extract()` — parse billing data from invoice text |
| [15 — Legal contract analysis](https://github.com/piyushgupta344/structured-llm/blob/main/examples/15-legal-contract-analysis.ts) | `generateMultiSchema()` — key terms + risk assessment simultaneously |
| [18 — Medical notes](https://github.com/piyushgupta344/structured-llm/blob/main/examples/18-medical-notes-extraction.ts) | Extract vitals, symptoms, medications from clinical notes |
| [21 — News fact extraction](https://github.com/piyushgupta344/structured-llm/blob/main/examples/21-news-fact-extraction.ts) | Entities, key claims, tone analysis from news articles |
| [24 — Email thread analysis](https://github.com/piyushgupta344/structured-llm/blob/main/examples/24-email-thread-analysis.ts) | Action items, decisions, sentiment from email threads |
| [28 — Academic paper](https://github.com/piyushgupta344/structured-llm/blob/main/examples/28-academic-paper-analysis.ts) | Metadata + contributions from research papers |
| [31 — Podcast show notes](https://github.com/piyushgupta344/structured-llm/blob/main/examples/31-podcast-show-notes.ts) | Chapters, quotes, resources from podcast transcripts |

## Classification & routing

| Example | What it does |
|---|---|
| [13 — Content moderation](https://github.com/piyushgupta344/structured-llm/blob/main/examples/13-content-moderation.ts) | Multi-category safety scoring |
| [14 — Support ticket routing](https://github.com/piyushgupta344/structured-llm/blob/main/examples/14-support-ticket-routing.ts) | `classify()` — route tickets with confidence scores |
| [34 — Multilingual feedback](https://github.com/piyushgupta344/structured-llm/blob/main/examples/34-multilingual-feedback.ts) | Detect language, translate, classify in bulk |
| [38 — Bug triage](https://github.com/piyushgupta344/structured-llm/blob/main/examples/38-bug-triage.ts) | Severity, priority, and owner assignment |

## Developer tools

| Example | What it does |
|---|---|
| [16 — Code security audit](https://github.com/piyushgupta344/structured-llm/blob/main/examples/16-code-security-audit.ts) | Detect OWASP vulnerabilities, generate secure rewrites |
| [20 — Git commit generator](https://github.com/piyushgupta344/structured-llm/blob/main/examples/20-git-commit-generator.ts) | `createTemplate()` — conventional commits from git diffs |
| [23 — NL to SQL](https://github.com/piyushgupta344/structured-llm/blob/main/examples/23-natural-language-to-sql.ts) | Plain English → parameterized SQL with schema awareness |
| [25 — API spec extraction](https://github.com/piyushgupta344/structured-llm/blob/main/examples/25-api-spec-extraction.ts) | OpenAPI-style spec from natural language descriptions |
| [36 — Test generation](https://github.com/piyushgupta344/structured-llm/blob/main/examples/36-test-generation.ts) | Unit tests from function signatures |

## Business intelligence

| Example | What it does |
|---|---|
| [19 — Job posting skills](https://github.com/piyushgupta344/structured-llm/blob/main/examples/19-job-posting-skills.ts) | Tech stack and requirements from job descriptions |
| [26 — Sales call CRM](https://github.com/piyushgupta344/structured-llm/blob/main/examples/26-sales-call-crm.ts) | CRM-ready data from sales call transcripts |
| [33 — Competitor analysis](https://github.com/piyushgupta344/structured-llm/blob/main/examples/33-competitor-analysis.ts) | `generateBatch()` — competitive intelligence at scale |
| [40 — Market research](https://github.com/piyushgupta344/structured-llm/blob/main/examples/40-market-research-template.ts) | `createTemplate()` — same framework across multiple markets |

## Data pipelines

| Example | What it does |
|---|---|
| [17 — Product catalog](https://github.com/piyushgupta344/structured-llm/blob/main/examples/17-product-catalog-normalization.ts) | Normalize messy product data from multiple suppliers |
| [27 — Log anomaly detection](https://github.com/piyushgupta344/structured-llm/blob/main/examples/27-log-anomaly-detection.ts) | Analyze server logs for incidents and root causes |
| [29 — Real estate listings](https://github.com/piyushgupta344/structured-llm/blob/main/examples/29-real-estate-listing.ts) | Parse multiple property listings in one call |
| [32 — Review aggregation](https://github.com/piyushgupta344/structured-llm/blob/main/examples/32-review-aggregation.ts) | Parse then aggregate product reviews into insights |
| [37 — Caching](https://github.com/piyushgupta344/structured-llm/blob/main/examples/37-caching-repeated-queries.ts) | `withCache()` — skip redundant API calls |
| [39 — Multi-schema document](https://github.com/piyushgupta344/structured-llm/blob/main/examples/39-multi-schema-document.ts) | Summary + quotes + actions from one document simultaneously |
