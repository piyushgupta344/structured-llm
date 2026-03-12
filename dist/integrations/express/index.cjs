'use strict';

var chunkHMRWKCK2_cjs = require('../../chunk-HMRWKCK2.cjs');

// integrations/express/index.ts
function structuredMiddleware(options) {
  const { promptFromBody, onError, ...generateOptions } = options;
  return async (req, res, next) => {
    try {
      const prompt = promptFromBody ? promptFromBody(req.body) : req.body?.prompt;
      const messages = !promptFromBody ? req.body?.messages : void 0;
      const { data, usage } = await chunkHMRWKCK2_cjs.generate({ ...generateOptions, prompt, messages });
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
function createStructuredHandler(config) {
  return async (req, res, next) => {
    const body = req.body;
    if (!body?.prompt && !body?.messages?.length) {
      res.status(400).json({ error: 'Request body must include "prompt" or "messages"' });
      return;
    }
    try {
      const result = await chunkHMRWKCK2_cjs.generate({
        ...config,
        prompt: body.prompt,
        messages: body.messages,
        systemPrompt: body.systemPrompt ?? config.systemPrompt
      });
      res.json(result);
    } catch (err) {
      if (next) {
        next(err);
      } else {
        res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
      }
    }
  };
}
function createStreamingHandler(config) {
  return async (req, res, next) => {
    const body = req.body;
    if (!body?.prompt && !body?.messages?.length) {
      res.status(400).json({ error: 'Request body must include "prompt" or "messages"' });
      return;
    }
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache, no-store");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Accel-Buffering", "no");
    try {
      const llmStream = chunkHMRWKCK2_cjs.generateStream({
        ...config,
        prompt: body.prompt,
        messages: body.messages,
        systemPrompt: body.systemPrompt ?? config.systemPrompt
      });
      for await (const event of llmStream) {
        res.write(JSON.stringify(event) + "\n");
      }
      res.end();
    } catch (err) {
      if (!res.headersSent) {
        if (next) {
          next(err);
        } else {
          res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
        }
      } else {
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }) + "\n");
      }
    }
  };
}
async function extractFromBody(body, options) {
  const { promptFromBody, onError: _ignored, ...generateOptions } = options;
  const prompt = promptFromBody ? promptFromBody(body) : body?.prompt;
  const { data } = await chunkHMRWKCK2_cjs.generate({ ...generateOptions, prompt });
  return data;
}

exports.createStreamingHandler = createStreamingHandler;
exports.createStructuredHandler = createStructuredHandler;
exports.extractFromBody = extractFromBody;
exports.structuredMiddleware = structuredMiddleware;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map