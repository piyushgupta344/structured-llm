// Mock provider clients for unit tests — no real API calls

export function mockOpenAIClient(responseText: string, opts: { toolCall?: boolean; tokens?: { prompt: number; completion: number } } = {}) {
  const usage = {
    prompt_tokens: opts.tokens?.prompt ?? 100,
    completion_tokens: opts.tokens?.completion ?? 50,
    total_tokens: (opts.tokens?.prompt ?? 100) + (opts.tokens?.completion ?? 50),
  };

  return {
    constructor: { name: "OpenAI" },
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async (params: { tool_choice?: unknown; response_format?: unknown }) => {
          if (params.tool_choice) {
            return {
              choices: [{
                message: {
                  tool_calls: [{
                    function: { arguments: responseText },
                  }],
                },
              }],
              usage,
            };
          }
          return {
            choices: [{ message: { content: responseText } }],
            usage,
          };
        }),
      },
    },
    models: { list: vi.fn() },
  };
}

export function mockStreamOpenAIClient(chunks: string[]) {
  const asyncIterator = async function* () {
    for (const chunk of chunks) {
      yield {
        choices: [{
          delta: {
            content: chunk,
            tool_calls: [{ function: { arguments: chunk } }],
          },
        }],
      };
    }
  };

  return {
    constructor: { name: "OpenAI" },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(asyncIterator()),
      },
    },
    models: { list: vi.fn() },
  };
}

export function mockAnthropicClient(responseText: string, opts: { toolUse?: boolean } = {}) {
  return {
    constructor: { name: "Anthropic" },
    messages: {
      create: vi.fn().mockResolvedValue({
        content: opts.toolUse
          ? [{ type: "tool_use", name: "extract_structured_data", input: JSON.parse(responseText) }]
          : [{ type: "text", text: responseText }],
        usage: { input_tokens: 80, output_tokens: 40 },
      }),
      stream: vi.fn().mockReturnValue((async function* () {
        for (const char of responseText) {
          yield {
            type: "content_block_delta",
            delta: { type: "text_delta", text: char },
          };
        }
      })()),
    },
  };
}

export function mockGeminiClient(responseText: string, opts: { functionCall?: boolean } = {}) {
  return {
    constructor: { name: "GoogleGenAI" },
    models: {
      generateContent: vi.fn().mockResolvedValue({
        candidates: [{
          content: {
            parts: opts.functionCall
              ? [{ functionCall: { name: "extract_structured_data", args: JSON.parse(responseText) } }]
              : [{ text: responseText }],
          },
        }],
        usageMetadata: { promptTokenCount: 60, candidatesTokenCount: 30 },
      }),
      generateContentStream: vi.fn().mockReturnValue((async function* () {
        yield { candidates: [{ content: { parts: [{ text: responseText }] } }] };
      })()),
    },
  };
}

export function mockMistralClient(responseText: string, opts: { toolCall?: boolean } = {}) {
  return {
    constructor: { name: "Mistral" },
    chat: {
      complete: vi.fn().mockResolvedValue({
        choices: opts.toolCall
          ? [{
              message: {
                toolCalls: [{ function: { arguments: responseText } }],
              },
            }]
          : [{ message: { content: responseText } }],
        usage: { promptTokens: 70, completionTokens: 35 },
      }),
      stream: vi.fn().mockReturnValue((async function* () {
        yield { data: { choices: [{ delta: { content: responseText } }] } };
      })()),
    },
  };
}

// A client that fails the first N attempts then succeeds.
// Handles both tool-calling and plain completion modes.
export function mockFlakyClient(failCount: number, successResponse: string) {
  let calls = 0;
  return {
    constructor: { name: "OpenAI" },
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async (params: { tool_choice?: unknown }) => {
          calls++;
          const isToolCall = !!params.tool_choice;
          if (calls <= failCount) {
            return isToolCall
              ? {
                  choices: [{ message: { tool_calls: [{ function: { arguments: "not valid json {" } }] } }],
                  usage: { prompt_tokens: 50, completion_tokens: 10 },
                }
              : {
                  choices: [{ message: { content: "not valid json {" } }],
                  usage: { prompt_tokens: 50, completion_tokens: 10 },
                };
          }
          return isToolCall
            ? {
                choices: [{ message: { tool_calls: [{ function: { arguments: successResponse } }] } }],
                usage: { prompt_tokens: 50, completion_tokens: 30 },
              }
            : {
                choices: [{ message: { content: successResponse } }],
                usage: { prompt_tokens: 50, completion_tokens: 30 },
              };
        }),
      },
    },
    models: { list: vi.fn() },
  };
}
