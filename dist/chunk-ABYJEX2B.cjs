'use strict';

var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/errors.ts
var StructuredLLMError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "StructuredLLMError";
  }
};
var ValidationError = class extends StructuredLLMError {
  constructor(issues, lastResponse, attempts) {
    super(
      `Schema validation failed after ${attempts} attempt(s).
Issues: ${JSON.stringify(issues, null, 2)}`
    );
    this.name = "ValidationError";
    this.issues = issues;
    this.lastResponse = lastResponse;
    this.attempts = attempts;
  }
};
var ParseError = class extends StructuredLLMError {
  constructor(lastResponse, attempts) {
    super(
      `LLM returned invalid JSON after ${attempts} attempt(s). Last response: ${lastResponse.slice(0, 200)}`
    );
    this.name = "ParseError";
    this.lastResponse = lastResponse;
    this.attempts = attempts;
  }
};
var ProviderError = class extends StructuredLLMError {
  constructor(provider, message, statusCode, originalError) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
};
var MaxRetriesError = class extends StructuredLLMError {
  constructor(attempts, lastError) {
    super(`Exceeded max retries (${attempts}). Last error: ${lastError}`);
    this.name = "MaxRetriesError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
};
var SchemaError = class extends StructuredLLMError {
  constructor(message) {
    super(`Invalid schema: ${message}`);
    this.name = "SchemaError";
  }
};
var UnsupportedProviderError = class extends StructuredLLMError {
  constructor(provider) {
    super(
      `Unsupported provider: "${provider}". Pass a supported client or set provider to one of: openai, anthropic, gemini, mistral, groq, azure-openai, xai, together, fireworks, perplexity, ollama, cohere, bedrock`
    );
    this.name = "UnsupportedProviderError";
  }
};
var MissingInputError = class extends StructuredLLMError {
  constructor() {
    super("You must provide either `prompt` or `messages`");
    this.name = "MissingInputError";
  }
};

// src/schema/adapters/zod.ts
function toJsonSchema(schema) {
  const z = schema;
  if (typeof z.toJSONSchema === "function") {
    return z.toJSONSchema();
  }
  try {
    const zodModule = __require("zod");
    if (typeof zodModule.toJSONSchema === "function") {
      return zodModule.toJSONSchema(schema);
    }
  } catch {
  }
  return zodV3ToJsonSchema(schema);
}
function zodV3ToJsonSchema(schema) {
  const def = schema._def;
  if (!def) return {};
  const typeName = def.typeName ?? "";
  switch (typeName) {
    case "ZodString": {
      const s = { type: "string" };
      for (const check of def.checks ?? []) {
        if (check.kind === "min") s.minLength = check.value;
        if (check.kind === "max") s.maxLength = check.value;
        if (check.kind === "regex") s.pattern = check.regex.source;
        if (check.kind === "email") s.format = "email";
        if (check.kind === "url") s.format = "uri";
      }
      return s;
    }
    case "ZodNumber": {
      const n = { type: "number" };
      for (const check of def.checks ?? []) {
        if (check.kind === "min") n.minimum = check.value;
        if (check.kind === "max") n.maximum = check.value;
        if (check.kind === "int") n.type = "integer";
      }
      return n;
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodNull":
      return { type: "null" };
    case "ZodUndefined":
    case "ZodNever":
      return {};
    case "ZodAny":
    case "ZodUnknown":
      return {};
    case "ZodLiteral":
      return { const: def.value };
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodNativeEnum": {
      const vals = Object.values(def.values).filter(
        (v) => typeof v === "string" || typeof v === "number"
      );
      return { enum: vals };
    }
    case "ZodArray": {
      const arr = { type: "array", items: zodV3ToJsonSchema(def.type) };
      if (def.minLength?.value != null) arr.minItems = def.minLength.value;
      if (def.maxLength?.value != null) arr.maxItems = def.maxLength.value;
      return arr;
    }
    case "ZodObject": {
      const shape = def.shape();
      const properties = {};
      const required = [];
      for (const [key, val] of Object.entries(shape)) {
        properties[key] = zodV3ToJsonSchema(val);
        const innerDef = val._def;
        if (innerDef?.typeName !== "ZodOptional" && innerDef?.typeName !== "ZodDefault") {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        required: required.length ? required : void 0,
        additionalProperties: false
      };
    }
    case "ZodOptional":
      return zodV3ToJsonSchema(def.innerType);
    case "ZodNullable": {
      const inner = zodV3ToJsonSchema(def.innerType);
      return { anyOf: [inner, { type: "null" }] };
    }
    case "ZodDefault":
      return zodV3ToJsonSchema(def.innerType);
    case "ZodEffects":
    case "ZodTransformer":
      return zodV3ToJsonSchema(def.schema);
    case "ZodUnion":
      return { anyOf: def.options.map((o) => zodV3ToJsonSchema(o)) };
    case "ZodDiscriminatedUnion":
      return { anyOf: [...def.options.values()].map((o) => zodV3ToJsonSchema(o)) };
    case "ZodIntersection":
      return { allOf: [zodV3ToJsonSchema(def.left), zodV3ToJsonSchema(def.right)] };
    case "ZodRecord": {
      const valSchema = def.valueType ? zodV3ToJsonSchema(def.valueType) : {};
      return { type: "object", additionalProperties: valSchema };
    }
    case "ZodTuple": {
      return {
        type: "array",
        items: def.items.map((i) => zodV3ToJsonSchema(i))
      };
    }
    default:
      return {};
  }
}
function createZodAdapter(schema) {
  const jsonSchema = toJsonSchema(schema);
  return {
    jsonSchema,
    parse(data) {
      return schema.parse(data);
    },
    safeParse(data) {
      const result = schema.safeParse(data);
      if (result.success) {
        return { success: true, data: result.data };
      }
      const errObj = result.error;
      const issues = errObj.issues ?? [];
      const formatted = issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
      return { success: false, error: formatted };
    }
  };
}
function isZodSchema(value) {
  return typeof value === "object" && value !== null && typeof value.safeParse === "function" && // eslint-disable-next-line @typescript-eslint/no-explicit-any
  typeof value._def === "object";
}

// src/schema/detect.ts
function isCustomSchema(value) {
  return typeof value === "object" && value !== null && "jsonSchema" in value && "parse" in value && typeof value.parse === "function";
}
function createCustomAdapter(schema) {
  return {
    jsonSchema: schema.jsonSchema,
    parse: schema.parse,
    safeParse: schema.safeParse ? schema.safeParse : (data) => {
      try {
        return { success: true, data: schema.parse(data) };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err)
        };
      }
    }
  };
}
function resolveSchema(schema) {
  if (isZodSchema(schema)) {
    return createZodAdapter(schema);
  }
  if (isCustomSchema(schema)) {
    return createCustomAdapter(schema);
  }
  throw new SchemaError(
    "Schema must be a Zod schema or a custom schema with { jsonSchema, parse }"
  );
}

// src/models.ts
var MODEL_REGISTRY = {
  // OpenAI
  "gpt-4o": { provider: "openai", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 128e3, inputCostPer1M: 2.5, outputCostPer1M: 10 },
  "gpt-4o-mini": { provider: "openai", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 128e3, inputCostPer1M: 0.15, outputCostPer1M: 0.6 },
  "gpt-4-turbo": { provider: "openai", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 128e3, inputCostPer1M: 10, outputCostPer1M: 30 },
  "gpt-4": { provider: "openai", toolCalling: true, jsonMode: false, streaming: true, contextWindow: 8192, inputCostPer1M: 30, outputCostPer1M: 60 },
  "gpt-3.5-turbo": { provider: "openai", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 16385, inputCostPer1M: 0.5, outputCostPer1M: 1.5 },
  "o1": { provider: "openai", toolCalling: false, jsonMode: false, streaming: false, contextWindow: 2e5, inputCostPer1M: 15, outputCostPer1M: 60 },
  "o1-mini": { provider: "openai", toolCalling: false, jsonMode: false, streaming: false, contextWindow: 128e3, inputCostPer1M: 3, outputCostPer1M: 12 },
  "o3-mini": { provider: "openai", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 2e5, inputCostPer1M: 1.1, outputCostPer1M: 4.4 },
  // Anthropic
  "claude-opus-4-6": { provider: "anthropic", toolCalling: true, jsonMode: false, streaming: true, contextWindow: 2e5, inputCostPer1M: 15, outputCostPer1M: 75 },
  "claude-sonnet-4-6": { provider: "anthropic", toolCalling: true, jsonMode: false, streaming: true, contextWindow: 2e5, inputCostPer1M: 3, outputCostPer1M: 15 },
  "claude-haiku-4-5": { provider: "anthropic", toolCalling: true, jsonMode: false, streaming: true, contextWindow: 2e5, inputCostPer1M: 0.8, outputCostPer1M: 4 },
  "claude-3-5-sonnet-20241022": { provider: "anthropic", toolCalling: true, jsonMode: false, streaming: true, contextWindow: 2e5, inputCostPer1M: 3, outputCostPer1M: 15 },
  "claude-3-5-haiku-20241022": { provider: "anthropic", toolCalling: true, jsonMode: false, streaming: true, contextWindow: 2e5, inputCostPer1M: 0.8, outputCostPer1M: 4 },
  "claude-3-opus-20240229": { provider: "anthropic", toolCalling: true, jsonMode: false, streaming: true, contextWindow: 2e5, inputCostPer1M: 15, outputCostPer1M: 75 },
  // Gemini
  "gemini-2.0-flash": { provider: "gemini", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 1048576, inputCostPer1M: 0.1, outputCostPer1M: 0.4 },
  "gemini-2.0-flash-lite": { provider: "gemini", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 1048576, inputCostPer1M: 0.075, outputCostPer1M: 0.3 },
  "gemini-1.5-pro": { provider: "gemini", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 2097152, inputCostPer1M: 1.25, outputCostPer1M: 5 },
  "gemini-1.5-flash": { provider: "gemini", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 1048576, inputCostPer1M: 0.075, outputCostPer1M: 0.3 },
  // Mistral
  "mistral-large-latest": { provider: "mistral", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 131072, inputCostPer1M: 2, outputCostPer1M: 6 },
  "mistral-small-latest": { provider: "mistral", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 131072, inputCostPer1M: 0.2, outputCostPer1M: 0.6 },
  "mistral-nemo": { provider: "mistral", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 131072, inputCostPer1M: 0.15, outputCostPer1M: 0.15 },
  "codestral-latest": { provider: "mistral", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 256e3, inputCostPer1M: 0.3, outputCostPer1M: 0.9 },
  // Groq (fast inference)
  "llama-3.3-70b-versatile": { provider: "groq", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 128e3, inputCostPer1M: 0.59, outputCostPer1M: 0.79 },
  "llama-3.1-8b-instant": { provider: "groq", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 128e3, inputCostPer1M: 0.05, outputCostPer1M: 0.08 },
  "mixtral-8x7b-32768": { provider: "groq", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 32768, inputCostPer1M: 0.24, outputCostPer1M: 0.24 },
  "gemma2-9b-it": { provider: "groq", toolCalling: false, jsonMode: true, streaming: true, contextWindow: 8192, inputCostPer1M: 0.2, outputCostPer1M: 0.2 },
  // xAI
  "grok-beta": { provider: "xai", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 131072, inputCostPer1M: 5, outputCostPer1M: 15 },
  "grok-2": { provider: "xai", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 131072, inputCostPer1M: 2, outputCostPer1M: 10 },
  // Together AI (open models)
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": { provider: "together", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 131072, inputCostPer1M: 0.88, outputCostPer1M: 0.88 },
  "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo": { provider: "together", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 131072, inputCostPer1M: 0.18, outputCostPer1M: 0.18 },
  "mistralai/Mixtral-8x7B-Instruct-v0.1": { provider: "together", toolCalling: false, jsonMode: true, streaming: true, contextWindow: 32768, inputCostPer1M: 0.6, outputCostPer1M: 0.6 },
  "Qwen/Qwen2.5-72B-Instruct-Turbo": { provider: "together", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 32768, inputCostPer1M: 1.2, outputCostPer1M: 1.2 },
  // Ollama (local — costs are $0)
  "llama3.2": { provider: "ollama", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 128e3, inputCostPer1M: 0, outputCostPer1M: 0 },
  "llama3.1": { provider: "ollama", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 128e3, inputCostPer1M: 0, outputCostPer1M: 0 },
  "mistral": { provider: "ollama", toolCalling: false, jsonMode: true, streaming: true, contextWindow: 32768, inputCostPer1M: 0, outputCostPer1M: 0 },
  "qwen2.5": { provider: "ollama", toolCalling: true, jsonMode: true, streaming: true, contextWindow: 131072, inputCostPer1M: 0, outputCostPer1M: 0 },
  "phi4": { provider: "ollama", toolCalling: false, jsonMode: true, streaming: true, contextWindow: 16384, inputCostPer1M: 0, outputCostPer1M: 0 }
};
function getModelCapabilities(model) {
  return MODEL_REGISTRY[model];
}
function listSupportedModels(filter) {
  if (!filter?.provider) return Object.keys(MODEL_REGISTRY);
  return Object.entries(MODEL_REGISTRY).filter(([, caps]) => caps.provider === filter.provider).map(([model]) => model);
}
function resolveMode(model, preferred) {
  if (preferred && preferred !== "auto") return preferred;
  const caps = MODEL_REGISTRY[model];
  if (!caps) {
    return "tool-calling";
  }
  if (caps.toolCalling) return "tool-calling";
  if (caps.jsonMode) return "json-mode";
  return "prompt-inject";
}

// src/providers/openai.ts
var OpenAIAdapter = class {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client, name = "openai") {
    this.client = client;
    this.name = name;
  }
  async complete(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const oaiMessages = messages.map((m) => ({
      role: m.role,
      content: m.content
    }));
    try {
      if (mode === "tool-calling") {
        const resp2 = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
          tools: [
            {
              type: "function",
              function: {
                name: schemaName,
                description: `Extract data matching the ${schemaName} schema`,
                parameters: schema
              }
            }
          ],
          tool_choice: { type: "function", function: { name: schemaName } }
        });
        const toolCall = resp2.choices[0]?.message?.tool_calls?.[0];
        if (!toolCall?.function?.arguments) {
          throw new ProviderError(this.name, "No tool call in response");
        }
        return {
          text: toolCall.function.arguments,
          promptTokens: resp2.usage?.prompt_tokens,
          completionTokens: resp2.usage?.completion_tokens
        };
      }
      if (mode === "json-mode") {
        const resp2 = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
          response_format: { type: "json_object" }
        });
        return {
          text: resp2.choices[0]?.message?.content ?? "",
          promptTokens: resp2.usage?.prompt_tokens,
          completionTokens: resp2.usage?.completion_tokens
        };
      }
      const resp = await this.client.chat.completions.create({
        model,
        messages: oaiMessages,
        temperature: temperature ?? 0,
        max_tokens: maxTokens
      });
      return {
        text: resp.choices[0]?.message?.content ?? "",
        promptTokens: resp.usage?.prompt_tokens,
        completionTokens: resp.usage?.completion_tokens
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const e = err;
      throw new ProviderError(
        this.name,
        e?.message ?? String(err),
        e?.status ?? e?.statusCode,
        err
      );
    }
  }
  async *stream(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const oaiMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    try {
      if (mode === "tool-calling") {
        const stream2 = await this.client.chat.completions.create({
          model,
          messages: oaiMessages,
          temperature: temperature ?? 0,
          max_tokens: maxTokens,
          tools: [
            {
              type: "function",
              function: {
                name: schemaName,
                description: `Extract data matching the ${schemaName} schema`,
                parameters: schema
              }
            }
          ],
          tool_choice: { type: "function", function: { name: schemaName } },
          stream: true
        });
        for await (const chunk of stream2) {
          const delta = chunk.choices[0]?.delta?.tool_calls?.[0]?.function?.arguments ?? "";
          if (delta) yield delta;
        }
        return;
      }
      const stream = await this.client.chat.completions.create({
        model,
        messages: oaiMessages,
        temperature: temperature ?? 0,
        max_tokens: maxTokens,
        ...mode === "json-mode" ? { response_format: { type: "json_object" } } : {},
        stream: true
      });
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) yield delta;
      }
    } catch (err) {
      const e = err;
      throw new ProviderError(this.name, e?.message ?? String(err), e?.status, err);
    }
  }
};
function isOpenAIClient(client) {
  return client?.constructor?.name === "OpenAI" || // some bundlers rename classes, so also check the API shape
  typeof client?.chat?.completions?.create === "function" && typeof client?.models?.list === "function";
}

// src/providers/anthropic.ts
var AnthropicAdapter = class {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client) {
    this.name = "anthropic";
    this.client = client;
  }
  async complete(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    try {
      if (mode === "tool-calling") {
        const resp2 = await this.client.messages.create({
          model,
          max_tokens: maxTokens ?? 4096,
          temperature: temperature ?? 0,
          system: systemMsg,
          messages: turns,
          tools: [
            {
              name: schemaName,
              description: `Extract data matching the ${schemaName} schema`,
              input_schema: { ...schema, type: "object" }
            }
          ],
          tool_choice: { type: "tool", name: schemaName }
        });
        const toolUse = resp2.content.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (b) => b.type === "tool_use" && b.name === schemaName
        );
        if (!toolUse) {
          throw new ProviderError("anthropic", "No tool_use block in response");
        }
        return {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          text: JSON.stringify(toolUse.input),
          promptTokens: resp2.usage?.input_tokens,
          completionTokens: resp2.usage?.output_tokens
        };
      }
      const systemWithSchema = [
        systemMsg,
        `Respond with ONLY valid JSON that matches this JSON Schema:
${JSON.stringify(schema, null, 2)}

Do not include markdown code fences or any text outside the JSON object.`
      ].filter(Boolean).join("\n\n");
      const resp = await this.client.messages.create({
        model,
        max_tokens: maxTokens ?? 4096,
        temperature: temperature ?? 0,
        system: systemWithSchema,
        messages: turns
      });
      const textBlock = resp.content.find((b) => b.type === "text");
      return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        text: textBlock?.text ?? "",
        promptTokens: resp.usage?.input_tokens,
        completionTokens: resp.usage?.output_tokens
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const e = err;
      throw new ProviderError("anthropic", e?.message ?? String(err), e?.status, err);
    }
  }
  async *stream(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
    try {
      if (mode === "tool-calling") {
        const stream2 = this.client.messages.stream({
          model,
          max_tokens: maxTokens ?? 4096,
          temperature: temperature ?? 0,
          system: systemMsg,
          messages: turns,
          tools: [
            {
              name: schemaName,
              description: `Extract data matching the ${schemaName} schema`,
              input_schema: { ...schema, type: "object" }
            }
          ],
          tool_choice: { type: "tool", name: schemaName }
        });
        for await (const event of stream2) {
          if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
            yield event.delta.partial_json ?? "";
          }
        }
        return;
      }
      const systemWithSchema = [
        systemMsg,
        `Respond with ONLY valid JSON matching this schema:
${JSON.stringify(schema, null, 2)}`
      ].filter(Boolean).join("\n\n");
      const stream = this.client.messages.stream({
        model,
        max_tokens: maxTokens ?? 4096,
        temperature: temperature ?? 0,
        system: systemWithSchema,
        messages: turns
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
          yield event.delta.text ?? "";
        }
      }
    } catch (err) {
      const e = err;
      throw new ProviderError("anthropic", e?.message ?? String(err), e?.status, err);
    }
  }
};
function isAnthropicClient(client) {
  return client?.constructor?.name === "Anthropic" || typeof client?.messages?.create === "function";
}

// src/providers/gemini.ts
var GeminiAdapter = class {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client) {
    this.name = "gemini";
    this.client = client;
  }
  async complete(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages.filter((m) => m.role !== "system").map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));
    const generationConfig = {
      temperature: temperature ?? 0,
      maxOutputTokens: maxTokens
    };
    try {
      if (mode === "tool-calling") {
        const functionDeclaration = {
          name: schemaName,
          description: `Extract data matching the ${schemaName} schema`,
          parameters: cleanSchemaForGemini(schema)
        };
        const resp2 = await this.client.models.generateContent({
          model,
          contents: turns,
          config: {
            ...generationConfig,
            systemInstruction: systemMsg,
            tools: [{ functionDeclarations: [functionDeclaration] }],
            toolConfig: {
              functionCallingConfig: {
                mode: "ANY",
                allowedFunctionNames: [schemaName]
              }
            }
          }
        });
        const candidate = resp2.candidates?.[0];
        const fnCall = candidate?.content?.parts?.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p) => p.functionCall?.name === schemaName
        );
        if (!fnCall?.functionCall?.args) {
          throw new ProviderError("gemini", "No function call in response");
        }
        return {
          text: JSON.stringify(fnCall.functionCall.args),
          promptTokens: resp2.usageMetadata?.promptTokenCount,
          completionTokens: resp2.usageMetadata?.candidatesTokenCount
        };
      }
      if (mode === "json-mode") {
        const resp2 = await this.client.models.generateContent({
          model,
          contents: turns,
          config: {
            ...generationConfig,
            systemInstruction: systemMsg,
            responseMimeType: "application/json",
            responseSchema: cleanSchemaForGemini(schema)
          }
        });
        const text2 = resp2.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        return {
          text: text2,
          promptTokens: resp2.usageMetadata?.promptTokenCount,
          completionTokens: resp2.usageMetadata?.candidatesTokenCount
        };
      }
      const lastTurn = turns.at(-1);
      if (lastTurn) {
        const schemaInstructions = `

Respond with ONLY valid JSON matching this schema:
${JSON.stringify(schema, null, 2)}`;
        lastTurn.parts[0].text += schemaInstructions;
      }
      const resp = await this.client.models.generateContent({
        model,
        contents: turns,
        config: { ...generationConfig, systemInstruction: systemMsg }
      });
      const text = resp.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      return {
        text,
        promptTokens: resp.usageMetadata?.promptTokenCount,
        completionTokens: resp.usageMetadata?.candidatesTokenCount
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const e = err;
      throw new ProviderError("gemini", e?.message ?? String(err), e?.status, err);
    }
  }
  async *stream(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const turns = messages.filter((m) => m.role !== "system").map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));
    try {
      const config = mode === "json-mode" ? {
        temperature: temperature ?? 0,
        maxOutputTokens: maxTokens,
        systemInstruction: systemMsg,
        responseMimeType: "application/json",
        responseSchema: cleanSchemaForGemini(schema)
      } : mode === "tool-calling" ? {
        temperature: temperature ?? 0,
        maxOutputTokens: maxTokens,
        systemInstruction: systemMsg,
        tools: [{ functionDeclarations: [{ name: schemaName, parameters: cleanSchemaForGemini(schema) }] }],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [schemaName] } }
      } : {
        temperature: temperature ?? 0,
        maxOutputTokens: maxTokens,
        systemInstruction: systemMsg
      };
      const stream = await this.client.models.generateContentStream({ model, contents: turns, config });
      for await (const chunk of stream) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) yield text;
      }
    } catch (err) {
      const e = err;
      throw new ProviderError("gemini", e?.message ?? String(err), e?.status, err);
    }
  }
};
function cleanSchemaForGemini(schema) {
  if (!schema || typeof schema !== "object") return schema;
  const { $schema, $defs, ...rest } = schema;
  const cleaned = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k === "properties" && typeof v === "object" && v !== null) {
      cleaned[k] = Object.fromEntries(
        Object.entries(v).map(([pk, pv]) => [
          pk,
          cleanSchemaForGemini(pv)
        ])
      );
    } else if (k === "items") {
      cleaned[k] = cleanSchemaForGemini(v);
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}
function isGeminiClient(client) {
  return client?.constructor?.name === "GoogleGenAI" || typeof client?.models?.generateContent === "function";
}

// src/providers/mistral.ts
var MistralAdapter = class {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client) {
    this.name = "mistral";
    this.client = client;
  }
  async complete(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const mistralMessages = messages.map((m) => ({
      role: m.role,
      content: m.content
    }));
    try {
      if (mode === "tool-calling") {
        const resp2 = await this.client.chat.complete({
          model,
          messages: mistralMessages,
          temperature: temperature ?? 0,
          maxTokens,
          tools: [
            {
              type: "function",
              function: {
                name: schemaName,
                description: `Extract data matching the ${schemaName} schema`,
                parameters: schema
              }
            }
          ],
          toolChoice: "any"
        });
        const toolCall = resp2.choices?.[0]?.message?.toolCalls?.[0];
        if (!toolCall?.function?.arguments) {
          throw new ProviderError("mistral", "No tool call in response");
        }
        const args = toolCall.function.arguments;
        return {
          text: typeof args === "string" ? args : JSON.stringify(args),
          promptTokens: resp2.usage?.promptTokens,
          completionTokens: resp2.usage?.completionTokens
        };
      }
      if (mode === "json-mode") {
        const resp2 = await this.client.chat.complete({
          model,
          messages: mistralMessages,
          temperature: temperature ?? 0,
          maxTokens,
          responseFormat: { type: "json_object" }
        });
        return {
          text: resp2.choices?.[0]?.message?.content ?? "",
          promptTokens: resp2.usage?.promptTokens,
          completionTokens: resp2.usage?.completionTokens
        };
      }
      const resp = await this.client.chat.complete({
        model,
        messages: mistralMessages,
        temperature: temperature ?? 0,
        maxTokens
      });
      return {
        text: resp.choices?.[0]?.message?.content ?? "",
        promptTokens: resp.usage?.promptTokens,
        completionTokens: resp.usage?.completionTokens
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const e = err;
      throw new ProviderError("mistral", e?.message ?? String(err), e?.statusCode, err);
    }
  }
  async *stream(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const mistralMessages = messages.map((m) => ({ role: m.role, content: m.content }));
    try {
      if (mode === "tool-calling") {
        const stream2 = await this.client.chat.stream({
          model,
          messages: mistralMessages,
          temperature: temperature ?? 0,
          maxTokens,
          tools: [
            {
              type: "function",
              function: {
                name: schemaName,
                description: `Extract data matching the ${schemaName} schema`,
                parameters: schema
              }
            }
          ],
          toolChoice: "any"
        });
        for await (const chunk of stream2) {
          const delta = chunk.data?.choices?.[0]?.delta?.toolCalls?.[0]?.function?.arguments ?? "";
          if (delta) yield delta;
        }
        return;
      }
      const stream = await this.client.chat.stream({
        model,
        messages: mistralMessages,
        temperature: temperature ?? 0,
        maxTokens,
        ...mode === "json-mode" ? { responseFormat: { type: "json_object" } } : {}
      });
      for await (const chunk of stream) {
        const delta = chunk.data?.choices?.[0]?.delta?.content ?? "";
        if (delta) yield delta;
      }
    } catch (err) {
      const e = err;
      throw new ProviderError("mistral", e?.message ?? String(err), e?.statusCode, err);
    }
  }
};
function isMistralClient(client) {
  return client?.constructor?.name === "Mistral" || typeof client?.chat?.complete === "function";
}

// src/providers/cohere.ts
var CohereAdapter = class {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(client) {
    this.name = "cohere";
    this.client = client;
  }
  async complete(req) {
    const { model, messages, schema, schemaName, mode, temperature, maxTokens } = req;
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const chatHistory = messages.filter((m) => m.role !== "system").slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "CHATBOT" : "USER",
      message: m.content
    }));
    const lastUserMsg = messages.filter((m) => m.role !== "system").at(-1)?.content ?? "";
    try {
      if (mode === "tool-calling") {
        const resp2 = await this.client.chat({
          model,
          message: lastUserMsg,
          chatHistory,
          preamble: systemMsg,
          temperature,
          maxTokens,
          tools: [
            {
              name: schemaName,
              description: `Extract data matching the ${schemaName} schema`,
              parameterDefinitions: jsonSchemaToCohereTool(schema)
            }
          ],
          forceToolUse: true
        });
        const toolCall = resp2.toolCalls?.[0];
        if (!toolCall?.parameters) {
          throw new ProviderError("cohere", "No tool call in response");
        }
        return {
          text: JSON.stringify(toolCall.parameters),
          promptTokens: resp2.meta?.tokens?.inputTokens,
          completionTokens: resp2.meta?.tokens?.outputTokens
        };
      }
      const resp = await this.client.chat({
        model,
        message: lastUserMsg,
        chatHistory,
        preamble: systemMsg ? `${systemMsg}

Respond with ONLY valid JSON matching: ${JSON.stringify(schema)}` : `Respond with ONLY valid JSON matching: ${JSON.stringify(schema)}`,
        temperature,
        maxTokens,
        responseFormat: { type: "json_object" }
      });
      return {
        text: resp.text ?? "",
        promptTokens: resp.meta?.tokens?.inputTokens,
        completionTokens: resp.meta?.tokens?.outputTokens
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      const e = err;
      throw new ProviderError("cohere", e?.message ?? String(err), e?.statusCode, err);
    }
  }
};
function jsonSchemaToCohereTool(schema) {
  const props = schema.properties ?? {};
  const required = schema.required ?? [];
  const result = {};
  for (const [key, val] of Object.entries(props)) {
    result[key] = {
      description: val.description ?? key,
      type: cohereType(val.type),
      required: required.includes(key)
    };
  }
  return result;
}
function cohereType(jsonType) {
  const map = {
    string: "str",
    number: "float",
    integer: "int",
    boolean: "bool",
    array: "list",
    object: "dict"
  };
  return map[jsonType] ?? "str";
}
function isCohereClient(client) {
  return client?.constructor?.name === "CohereClient" || client?.constructor?.name === "Cohere" || typeof client?.chat === "function";
}

// src/providers/registry.ts
var COMPAT_URLS = {
  "api.groq.com": "groq",
  "api.x.ai": "xai",
  "api.together.xyz": "together",
  "api.fireworks.ai": "fireworks",
  "api.perplexity.ai": "perplexity",
  "localhost": "ollama",
  "127.0.0.1": "ollama",
  "openai.azure.com": "azure-openai"
};
function detectCompatProvider(client) {
  const baseURL = client?.baseURL ?? client?._options?.baseURL ?? "";
  for (const [pattern, name] of Object.entries(COMPAT_URLS)) {
    if (baseURL.includes(pattern)) return name;
  }
  return null;
}
function adapterFromClient(client) {
  if (isAnthropicClient(client)) return new AnthropicAdapter(client);
  if (isGeminiClient(client)) return new GeminiAdapter(client);
  if (isMistralClient(client)) return new MistralAdapter(client);
  if (isCohereClient(client)) return new CohereAdapter(client);
  if (isOpenAIClient(client)) {
    const compatName = detectCompatProvider(client);
    return new OpenAIAdapter(client, compatName ?? "openai");
  }
  throw new UnsupportedProviderError("unknown \u2014 could not detect provider from client");
}
async function adapterFromProvider(provider, apiKey, baseURL) {
  const key = apiKey ?? getEnvKey(provider);
  switch (provider) {
    case "openai": {
      const { default: OpenAI } = await import('openai');
      return new OpenAIAdapter(new OpenAI({ apiKey: key, baseURL }), "openai");
    }
    case "anthropic": {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      return new AnthropicAdapter(new Anthropic({ apiKey: key }));
    }
    case "gemini": {
      const { GoogleGenAI } = await import('@google/genai');
      return new GeminiAdapter(new GoogleGenAI({ apiKey: key }));
    }
    case "mistral": {
      const { Mistral } = await import('@mistralai/mistralai');
      return new MistralAdapter(new Mistral({ apiKey: key }));
    }
    case "groq": {
      const { default: OpenAI } = await import('openai');
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL: baseURL ?? "https://api.groq.com/openai/v1" }),
        "groq"
      );
    }
    case "xai": {
      const { default: OpenAI } = await import('openai');
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL: baseURL ?? "https://api.x.ai/v1" }),
        "xai"
      );
    }
    case "together": {
      const { default: OpenAI } = await import('openai');
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL: baseURL ?? "https://api.together.xyz/v1" }),
        "together"
      );
    }
    case "fireworks": {
      const { default: OpenAI } = await import('openai');
      return new OpenAIAdapter(
        new OpenAI({
          apiKey: key,
          baseURL: baseURL ?? "https://api.fireworks.ai/inference/v1"
        }),
        "fireworks"
      );
    }
    case "perplexity": {
      const { default: OpenAI } = await import('openai');
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL: baseURL ?? "https://api.perplexity.ai" }),
        "perplexity"
      );
    }
    case "ollama": {
      const { default: OpenAI } = await import('openai');
      return new OpenAIAdapter(
        new OpenAI({ apiKey: "ollama", baseURL: baseURL ?? "http://localhost:11434/v1" }),
        "ollama"
      );
    }
    case "azure-openai": {
      const { default: OpenAI } = await import('openai');
      if (!baseURL) throw new Error("azure-openai requires baseURL (your Azure endpoint)");
      return new OpenAIAdapter(
        new OpenAI({ apiKey: key, baseURL }),
        "azure-openai"
      );
    }
    case "cohere": {
      const { CohereClient } = await import('cohere-ai');
      return new CohereAdapter(new CohereClient({ token: key }));
    }
    default:
      throw new UnsupportedProviderError(provider);
  }
}
function getEnvKey(provider) {
  const envMap = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    gemini: "GEMINI_API_KEY",
    mistral: "MISTRAL_API_KEY",
    groq: "GROQ_API_KEY",
    "azure-openai": "AZURE_OPENAI_API_KEY",
    xai: "XAI_API_KEY",
    together: "TOGETHER_API_KEY",
    fireworks: "FIREWORKS_API_KEY",
    perplexity: "PERPLEXITY_API_KEY",
    ollama: "",
    cohere: "COHERE_API_KEY",
    bedrock: "AWS_ACCESS_KEY_ID"
  };
  const envVar = envMap[provider];
  return envVar ? process.env[envVar] : void 0;
}

// src/usage.ts
function calcCost(model, promptTokens, completionTokens) {
  const caps = getModelCapabilities(model);
  if (!caps || !caps.inputCostPer1M || !caps.outputCostPer1M) return 0;
  return promptTokens / 1e6 * caps.inputCostPer1M + completionTokens / 1e6 * caps.outputCostPer1M;
}
function buildUsage(model, provider, promptTokens, completionTokens, startTime, attempts) {
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    estimatedCostUsd: calcCost(model, promptTokens, completionTokens),
    latencyMs: Date.now() - startTime,
    attempts,
    model,
    provider
  };
}
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

// src/retry.ts
async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function retryDelay(attempt, options) {
  const strategy = options?.strategy ?? "immediate";
  const base = options?.baseDelayMs ?? 500;
  switch (strategy) {
    case "immediate":
      return 0;
    case "linear":
      return base * attempt;
    case "exponential":
      return base * Math.pow(2, attempt - 1);
    default:
      return 0;
  }
}
function buildRetryMessage(attempt, maxRetries, errorType, errorDetails, previousResponse) {
  const attemptsLeft = maxRetries - attempt;
  const intro = errorType === "parse" ? "Your response was not valid JSON. You must respond with ONLY a JSON object." : `Your response failed schema validation. Please fix the following errors:`;
  return [
    intro,
    errorType === "validation" ? `
Errors:
${errorDetails}` : "",
    `
Previous response (for reference):
${previousResponse.slice(0, 500)}`,
    `
${attemptsLeft > 0 ? `Attempt ${attempt + 1} of ${maxRetries + 1}. ` : ""}Respond with ONLY the corrected JSON object, no markdown, no explanations.`
  ].join("").trim();
}
function extractJSON(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  const useArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
  if (useArray) {
    const arrEnd = text.lastIndexOf("]");
    if (arrEnd > arrStart) return text.slice(arrStart, arrEnd + 1);
  }
  if (objStart !== -1) {
    const end = text.lastIndexOf("}");
    if (end > objStart) return text.slice(objStart, end + 1);
  }
  return text.trim();
}

// src/hooks.ts
async function runHook(hooks, event, ctx) {
  if (!hooks) return;
  const fn = hooks[event];
  if (fn) await fn(ctx);
}
async function emitRequest(hooks, messages, model, provider, attempt) {
  await runHook(hooks, "onRequest", { messages, model, provider, attempt });
}
async function emitResponse(hooks, rawResponse, attempt, model) {
  await runHook(hooks, "onResponse", { rawResponse, attempt, model });
}
async function emitRetry(hooks, attempt, maxRetries, error, model) {
  await runHook(hooks, "onRetry", { attempt, maxRetries, error, model });
}
async function emitSuccess(hooks, result, usage) {
  await runHook(hooks, "onSuccess", { result, usage });
}
async function emitError(hooks, error, allAttempts) {
  await runHook(hooks, "onError", { error, allAttempts });
}

// src/generate.ts
async function generate(options) {
  const {
    client,
    provider,
    apiKey,
    baseURL,
    model,
    schema,
    prompt,
    messages,
    systemPrompt,
    mode: modeOverride,
    maxRetries = 3,
    retryOptions,
    temperature = 0,
    maxTokens,
    trackUsage = false,
    hooks,
    fallbackChain
  } = options;
  if (!prompt && !messages?.length) throw new MissingInputError();
  const adapter = resolveSchema(schema);
  const builtMessages = buildMessages(prompt, messages, systemPrompt, adapter.jsonSchema, modeOverride ?? "auto", model);
  const targets = buildTargets(client, provider, apiKey, baseURL, fallbackChain);
  const startTime = Date.now();
  let lastError = new Error("Unknown error");
  for (const target of targets) {
    try {
      const providerAdapter = await resolveAdapter(target);
      const resolvedMode = resolveMode(model, modeOverride);
      const schemaName = getSchemaName(schema);
      const result = await runWithRetry({
        adapter: providerAdapter,
        schemaAdapter: adapter,
        messages: builtMessages,
        model,
        schemaName,
        mode: resolvedMode,
        temperature,
        maxTokens,
        maxRetries,
        retryOptions,
        hooks,
        startTime,
        trackUsage
      });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof ValidationError || err instanceof MaxRetriesError) {
        throw err;
      }
    }
  }
  throw lastError;
}
async function runWithRetry(opts) {
  const {
    adapter,
    schemaAdapter,
    model,
    schemaName,
    mode,
    temperature,
    maxTokens,
    maxRetries,
    retryOptions,
    hooks,
    startTime,
    trackUsage
  } = opts;
  let currentMessages = [...opts.messages];
  let promptTokens = 0;
  let completionTokens = 0;
  let lastRaw = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await emitRequest(hooks, currentMessages, model, adapter.name, attempt + 1);
    const resp = await adapter.complete({
      model,
      messages: currentMessages,
      schema: schemaAdapter.jsonSchema,
      schemaName,
      mode,
      temperature,
      maxTokens
    });
    lastRaw = resp.text;
    promptTokens += resp.promptTokens ?? 0;
    completionTokens += resp.completionTokens ?? 0;
    await emitResponse(hooks, lastRaw, attempt + 1, model);
    let parsed;
    try {
      const cleaned = extractJSON(lastRaw);
      parsed = JSON.parse(cleaned);
    } catch {
      if (attempt >= maxRetries) {
        const err = new ParseError(lastRaw, attempt + 1);
        await emitError(hooks, err, attempt + 1);
        throw err;
      }
      await emitRetry(hooks, attempt + 1, maxRetries, "Invalid JSON", model);
      const delay2 = retryDelay(attempt + 1, retryOptions);
      if (delay2 > 0) await sleep(delay2);
      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: lastRaw },
        {
          role: "user",
          content: buildRetryMessage(attempt + 1, maxRetries, "parse", "", lastRaw)
        }
      ];
      continue;
    }
    const validation = schemaAdapter.safeParse(parsed);
    if (validation.success) {
      const usage = trackUsage ? buildUsage(model, adapter.name, promptTokens, completionTokens, startTime, attempt + 1) : void 0;
      await emitSuccess(hooks, validation.data, usage);
      return { data: validation.data, usage };
    }
    if (attempt >= maxRetries) {
      const err = new ValidationError(
        typeof validation.error === "string" ? [validation.error] : [validation.error],
        lastRaw,
        attempt + 1
      );
      await emitError(hooks, err, attempt + 1);
      throw err;
    }
    await emitRetry(hooks, attempt + 1, maxRetries, validation.error, model);
    const delay = retryDelay(attempt + 1, retryOptions);
    if (delay > 0) await sleep(delay);
    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: lastRaw },
      {
        role: "user",
        content: buildRetryMessage(
          attempt + 1,
          maxRetries,
          "validation",
          validation.error,
          lastRaw
        )
      }
    ];
  }
  throw new MaxRetriesError(maxRetries, lastRaw.slice(0, 200));
}
function buildMessages(prompt, messages, systemPrompt, jsonSchema, mode, model) {
  const result = [];
  const resolvedMode = resolveMode(model, mode);
  if (resolvedMode === "prompt-inject") {
    const schemaInstructions = `Respond with ONLY valid JSON (no markdown, no explanation) matching this JSON Schema:
${JSON.stringify(jsonSchema, null, 2)}`;
    const sys = systemPrompt ? `${systemPrompt}

${schemaInstructions}` : schemaInstructions;
    result.push({ role: "system", content: sys });
  } else if (systemPrompt) {
    result.push({ role: "system", content: systemPrompt });
  }
  if (messages?.length) {
    const hasSystem = messages.some((m) => m.role === "system");
    if (hasSystem) {
      return messages;
    }
    result.push(...messages);
  }
  if (prompt) {
    result.push({ role: "user", content: prompt });
  }
  return result;
}
function buildTargets(client, provider, apiKey, baseURL, fallbackChain) {
  const primary = client ? { client } : { provider, apiKey, baseURL };
  const fallbacks = fallbackChain ?? [];
  return [primary, ...fallbacks];
}
async function resolveAdapter(target) {
  if (target.client) return adapterFromClient(target.client);
  if (target.provider) return adapterFromProvider(target.provider, target.apiKey, target.baseURL);
  throw new Error("Target must have client or provider");
}
function getSchemaName(schema) {
  return schema?.description ?? schema?._def?.description ?? "extract_structured_data";
}

exports.MaxRetriesError = MaxRetriesError;
exports.MissingInputError = MissingInputError;
exports.ParseError = ParseError;
exports.ProviderError = ProviderError;
exports.SchemaError = SchemaError;
exports.StructuredLLMError = StructuredLLMError;
exports.UnsupportedProviderError = UnsupportedProviderError;
exports.ValidationError = ValidationError;
exports.adapterFromClient = adapterFromClient;
exports.adapterFromProvider = adapterFromProvider;
exports.buildUsage = buildUsage;
exports.estimateTokens = estimateTokens;
exports.extractJSON = extractJSON;
exports.generate = generate;
exports.getModelCapabilities = getModelCapabilities;
exports.listSupportedModels = listSupportedModels;
exports.resolveMode = resolveMode;
exports.resolveSchema = resolveSchema;
//# sourceMappingURL=chunk-ABYJEX2B.cjs.map
//# sourceMappingURL=chunk-ABYJEX2B.cjs.map