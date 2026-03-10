export class StructuredLLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructuredLLMError";
  }
}

export class ValidationError extends StructuredLLMError {
  issues: unknown[];
  lastResponse: string;
  attempts: number;

  constructor(issues: unknown[], lastResponse: string, attempts: number) {
    super(
      `Schema validation failed after ${attempts} attempt(s).\nIssues: ${JSON.stringify(issues, null, 2)}`
    );
    this.name = "ValidationError";
    this.issues = issues;
    this.lastResponse = lastResponse;
    this.attempts = attempts;
  }
}

export class ParseError extends StructuredLLMError {
  lastResponse: string;
  attempts: number;

  constructor(lastResponse: string, attempts: number) {
    super(
      `LLM returned invalid JSON after ${attempts} attempt(s). Last response: ${lastResponse.slice(0, 200)}`
    );
    this.name = "ParseError";
    this.lastResponse = lastResponse;
    this.attempts = attempts;
  }
}

export class ProviderError extends StructuredLLMError {
  provider: string;
  statusCode?: number;
  originalError: unknown;

  constructor(provider: string, message: string, statusCode?: number, originalError?: unknown) {
    super(`[${provider}] ${message}`);
    this.name = "ProviderError";
    this.provider = provider;
    this.statusCode = statusCode;
    this.originalError = originalError;
  }
}

export class MaxRetriesError extends StructuredLLMError {
  attempts: number;
  lastError: string;

  constructor(attempts: number, lastError: string) {
    super(`Exceeded max retries (${attempts}). Last error: ${lastError}`);
    this.name = "MaxRetriesError";
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export class SchemaError extends StructuredLLMError {
  constructor(message: string) {
    super(`Invalid schema: ${message}`);
    this.name = "SchemaError";
  }
}

export class UnsupportedProviderError extends StructuredLLMError {
  constructor(provider: string) {
    super(
      `Unsupported provider: "${provider}". Pass a supported client or set provider to one of: openai, anthropic, gemini, mistral, groq, azure-openai, xai, together, fireworks, perplexity, ollama, cohere, bedrock`
    );
    this.name = "UnsupportedProviderError";
  }
}

export class MissingInputError extends StructuredLLMError {
  constructor() {
    super("You must provide either `prompt` or `messages`");
    this.name = "MissingInputError";
  }
}
