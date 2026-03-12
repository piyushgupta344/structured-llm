import { generate, generateStream } from '../../chunk-3JZFHT3L.js';

// integrations/hono/index.ts
function structuredLLM(options) {
  const { promptFromBody, ...generateOptions } = options;
  return async (c, next) => {
    try {
      let prompt;
      let messages;
      if (promptFromBody) {
        const body = await c.req.json();
        prompt = promptFromBody(body);
      } else {
        const body = await c.req.json();
        prompt = body.prompt;
        messages = body.messages;
      }
      const { data, usage } = await generate({
        ...generateOptions,
        prompt,
        messages,
        signal: c.req.raw?.signal
      });
      c.set("structuredResult", data);
      c.set("structuredUsage", usage);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Structured LLM error";
      return c.json({ error: message }, 500);
    }
  };
}
function createStructuredHandler(config) {
  return async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!body?.prompt && !body?.messages?.length) {
      return c.json({ error: 'Request body must include "prompt" or "messages"' }, 400);
    }
    try {
      const result = await generate({
        ...config,
        prompt: body.prompt,
        messages: body.messages,
        systemPrompt: body.systemPrompt ?? config.systemPrompt,
        signal: c.req.raw?.signal
      });
      return c.json(result);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
    }
  };
}
function createStreamingHandler(config) {
  return async (c) => {
    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }
    if (!body?.prompt && !body?.messages?.length) {
      return c.json({ error: 'Request body must include "prompt" or "messages"' }, 400);
    }
    const llmStream = generateStream({
      ...config,
      prompt: body.prompt,
      messages: body.messages,
      systemPrompt: body.systemPrompt ?? config.systemPrompt,
      signal: c.req.raw?.signal
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
    return c.body(readable, 200, {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no"
    });
  };
}
async function extractFromRequest(c, options) {
  const { promptFromBody, ...generateOptions } = options;
  let prompt;
  if (promptFromBody) {
    const body = await c.req.json();
    prompt = promptFromBody(body);
  }
  const { data } = await generate({ ...generateOptions, prompt, signal: c.req.raw?.signal });
  return data;
}

export { createStreamingHandler, createStructuredHandler, extractFromRequest, structuredLLM };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map