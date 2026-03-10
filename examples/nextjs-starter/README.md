# structured-llm — Next.js starter

A minimal Next.js 15 app showing how to use `structured-llm` in API routes, Server Actions, and with streaming.

## What's included

| Route | What it does |
|---|---|
| `POST /api/analyze` | `generate()` — sentiment, key points, topics |
| `POST /api/classify` | `classify()` — route to a category with confidence |
| `POST /api/extract` | `extract()` — pull specific fields from free text |
| `POST /api/stream` | `generateStream()` — streaming structured output as SSE |

## Setup

```bash
cp .env.example .env.local
# Add your OPENAI_API_KEY

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll see a simple UI to try each endpoint.

## Example API calls

```bash
# Analyze text
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "The new MacBook is incredible but way too expensive."}'

# Classify
curl -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -d '{"text": "My payment failed", "categories": ["billing", "auth", "bug"]}'

# Extract fields
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{"text": "Invoice from Acme, total $299, due March 31", "fields": {"vendor": "string", "amount": "number", "dueDate": "date"}}'
```

## Streaming

The `/api/stream` route returns Server-Sent Events. Connect from the client:

```typescript
const source = new EventSource('/api/stream');
source.onmessage = (event) => {
  const { partial, isDone } = JSON.parse(event.data);
  if (isDone) source.close();
  else updateUI(partial); // render partial object in real-time
};
```

## Customizing

- Swap the schema in `/api/analyze/route.ts` with your own Zod schema
- Add `fallbackChain` for automatic provider fallback
- Use `createClient()` in `lib/llm.ts` to share config across routes
- See the [full docs](https://structured-llm.dev) for all options
