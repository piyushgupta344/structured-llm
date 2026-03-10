import type { RetryOptions } from "./types.js";

export async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function retryDelay(attempt: number, options?: RetryOptions): number {
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

// Build the retry message that gets appended to messages on each failed attempt.
// Making this LLM-friendly is important — we want it to actually fix the issue.
export function buildRetryMessage(
  attempt: number,
  maxRetries: number,
  errorType: "parse" | "validation",
  errorDetails: string,
  previousResponse: string
): string {
  const attemptsLeft = maxRetries - attempt;
  const intro =
    errorType === "parse"
      ? "Your response was not valid JSON. You must respond with ONLY a JSON object."
      : `Your response failed schema validation. Please fix the following errors:`;

  return [
    intro,
    errorType === "validation" ? `\nErrors:\n${errorDetails}` : "",
    `\nPrevious response (for reference):\n${previousResponse.slice(0, 500)}`,
    `\n${attemptsLeft > 0 ? `Attempt ${attempt + 1} of ${maxRetries + 1}. ` : ""}Respond with ONLY the corrected JSON object, no markdown, no explanations.`,
  ]
    .join("")
    .trim();
}

// Extract JSON from a string that might have markdown fences or surrounding text
export function extractJSON(text: string): string {
  // strip markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // find outermost JSON container — pick whichever ({ or [) appears first
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");

  // determine which container starts first
  const useArray =
    arrStart !== -1 &&
    (objStart === -1 || arrStart < objStart);

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
