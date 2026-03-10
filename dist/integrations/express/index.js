import { generate } from '../../chunk-XI3I6EK3.js';

// integrations/express/index.ts
function structuredMiddleware(options) {
  const { promptFromBody, onError, ...generateOptions } = options;
  return async (req, res, next) => {
    try {
      const prompt = promptFromBody ? promptFromBody(req.body) : req.body?.prompt;
      const { data, usage } = await generate({ ...generateOptions, prompt });
      req.structured = data;
      req.structuredUsage = usage;
      next();
    } catch (err) {
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)), req, res, next);
      } else {
        res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
      }
    }
  };
}
async function extractFromBody(body, options) {
  const { promptFromBody, onError: _ignored, ...generateOptions } = options;
  const prompt = promptFromBody ? promptFromBody(body) : body?.prompt;
  const { data } = await generate({ ...generateOptions, prompt });
  return data;
}

export { extractFromBody, structuredMiddleware };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map