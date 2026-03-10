import { generate } from '../../chunk-XI3I6EK3.js';

// integrations/hono/index.ts
function structuredLLM(options) {
  const { promptFromBody, ...generateOptions } = options;
  return async (c, next) => {
    try {
      let prompt;
      if (promptFromBody) {
        const body = await c.req.json();
        prompt = promptFromBody(body);
      }
      const { data, usage } = await generate({ ...generateOptions, prompt });
      c.set("structuredResult", data);
      c.set("structuredUsage", usage);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Structured LLM error";
      return c.json({ error: message }, 500);
    }
  };
}
async function extractFromRequest(c, options) {
  const { promptFromBody, ...generateOptions } = options;
  let prompt;
  if (promptFromBody) {
    const body = await c.req.json();
    prompt = promptFromBody(body);
  }
  const { data } = await generate({ ...generateOptions, prompt });
  return data;
}

export { extractFromRequest, structuredLLM };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map