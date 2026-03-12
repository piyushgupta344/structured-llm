import { z } from "zod";
import type { GenerateOptions, UsageInfo, ZodLike } from "./types.js";
import { generate } from "./generate.js";

export type ClassifyOption =
  | string
  | { value: string; description?: string };

export interface ClassifyOptions
  extends Omit<GenerateOptions<ZodLike>, "schema" | "prompt" | "messages"> {
  prompt?: string;
  messages?: GenerateOptions<ZodLike>["messages"];
  options: ClassifyOption[];
  allowMultiple?: boolean;
  includeConfidence?: boolean;
  includeReasoning?: boolean;
}

export interface ClassifyResult {
  // single label (first when allowMultiple=true)
  label: string;
  // always an array — convenient for both single and multi-label
  labels: string[];
  confidence?: number;
  reasoning?: string;
  usage?: UsageInfo;
}

export async function classify(opts: ClassifyOptions): Promise<ClassifyResult> {
  const {
    options,
    allowMultiple = false,
    includeConfidence = false,
    includeReasoning = false,
    prompt,
    messages,
    ...rest
  } = opts;

  const normalizedOptions = options.map((o) =>
    typeof o === "string" ? { value: o } : o
  );

  const optionList = normalizedOptions
    .map((o) => `  - "${o.value}"${o.description ? ` — ${o.description}` : ""}`)
    .join("\n");

  const enumValues = normalizedOptions.map((o) => o.value) as [string, ...string[]];

  const schema = allowMultiple
    ? z.object({
        labels: z.array(z.enum(enumValues)).describe("All matching categories"),
        ...(includeConfidence ? { confidence: z.number().min(0).max(1) } : {}),
        ...(includeReasoning ? { reasoning: z.string() } : {}),
      })
    : z.object({
        label: z.enum(enumValues),
        ...(includeConfidence ? { confidence: z.number().min(0).max(1) } : {}),
        ...(includeReasoning ? { reasoning: z.string() } : {}),
      });

  const classifySystem = [
    `Classify the input into ${allowMultiple ? "one or more" : "exactly one"} of these categories:`,
    optionList,
    includeConfidence ? "Include a confidence score from 0 (not confident) to 1 (very confident)." : "",
    includeReasoning ? "Include a brief one-sentence reasoning for your classification." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const result = await generate({
    ...rest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    schema: schema as any,
    prompt,
    messages,
    systemPrompt: rest.systemPrompt ? `${rest.systemPrompt}\n\n${classifySystem}` : classifySystem,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = result.data as any;
  const labels: string[] = allowMultiple ? (data.labels ?? []) : [data.label];

  return {
    label: labels[0] ?? "",
    labels,
    confidence: data.confidence,
    reasoning: data.reasoning,
    usage: result.usage,
  };
}
