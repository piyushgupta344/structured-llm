import { generate, generateStream } from '../../chunk-3JZFHT3L.js';

// integrations/next/index.ts
function withStructured(config) {
  return async function(input) {
    const { data } = await generate({ ...config, ...input });
    return data;
  };
}
function createStructuredRoute(config) {
  return async function POST(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body?.prompt && !body?.messages?.length) {
      return Response.json(
        { error: 'Request body must include "prompt" or "messages"' },
        { status: 400 }
      );
    }
    try {
      const result = await generate({
        ...config,
        prompt: body.prompt,
        messages: body.messages,
        systemPrompt: body.systemPrompt ?? config.systemPrompt,
        signal: request.signal
      });
      return Response.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status = err.statusCode;
      return Response.json({ error: message }, { status: status && status >= 400 ? status : 500 });
    }
  };
}
var structuredRoute = createStructuredRoute;
function createStreamingRoute(config) {
  return async function POST(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body?.prompt && !body?.messages?.length) {
      return Response.json(
        { error: 'Request body must include "prompt" or "messages"' },
        { status: 400 }
      );
    }
    const llmStream = generateStream({
      ...config,
      prompt: body.prompt,
      messages: body.messages,
      systemPrompt: body.systemPrompt ?? config.systemPrompt,
      signal: request.signal
    });
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of llmStream) {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          }
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(JSON.stringify({ error: message }) + "\n"));
          controller.close();
        }
      }
    });
    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-store",
        "X-Accel-Buffering": "no"
      }
    });
  };
}

export { createStreamingRoute, createStructuredRoute, structuredRoute, withStructured };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map