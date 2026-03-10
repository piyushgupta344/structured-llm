import { generate } from '../../chunk-XI3I6EK3.js';

// integrations/next/index.ts
function withStructured(config) {
  return async function(input) {
    const { data } = await generate({ ...config, ...input });
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
      const { data, usage } = await generate({ ...config, prompt: body.prompt });
      return Response.json({ data, usage });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}

export { structuredRoute, withStructured };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map