'use strict';

var chunkABYJEX2B_cjs = require('../../chunk-ABYJEX2B.cjs');

// integrations/next/index.ts
function withStructured(config) {
  return async function(input) {
    const { data } = await chunkABYJEX2B_cjs.generate({ ...config, ...input });
    return data;
  };
}
function structuredRoute(config) {
  return async function(req) {
    try {
      const body = await req.json();
      if (!body.prompt) {
        return Response.json({ error: "prompt is required" }, { status: 400 });
      }
      const { data, usage } = await chunkABYJEX2B_cjs.generate({ ...config, prompt: body.prompt });
      return Response.json({ data, usage });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

exports.structuredRoute = structuredRoute;
exports.withStructured = withStructured;
//# sourceMappingURL=index.cjs.map
//# sourceMappingURL=index.cjs.map