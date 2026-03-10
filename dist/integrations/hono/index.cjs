'use strict';

var chunkABYJEX2B_cjs = require('../../chunk-ABYJEX2B.cjs');

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
      const { data, usage } = await chunkABYJEX2B_cjs.generate({ ...generateOptions, prompt });
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
  const { data } = await chunkABYJEX2B_cjs.generate({ ...generateOptions, prompt });
  return data;
}

exports.extractFromRequest = extractFromRequest;
exports.structuredLLM = structuredLLM;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map