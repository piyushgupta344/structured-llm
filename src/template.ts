import type { z } from "zod";
import type { GenerateArrayOptions, GenerateArrayResult, GenerateOptions, GenerateResult, ZodLike } from "./types.js";
import { generate } from "./generate.js";
import { generateArray } from "./generate-array.js";

export type TemplateVars = Record<string, string | number>;

export interface TemplateConfig<TSchema extends ZodLike>
  extends Omit<GenerateOptions<TSchema>, "prompt" | "messages"> {
  template: string;
}

export interface BoundTemplate<TSchema extends ZodLike> {
  run(
    vars: TemplateVars,
    overrides?: Partial<Omit<GenerateOptions<TSchema>, "prompt">>
  ): Promise<GenerateResult<z.infer<TSchema>>>;

  runArray(
    vars: TemplateVars,
    overrides?: Partial<Omit<GenerateArrayOptions<TSchema>, "prompt">>
  ): Promise<GenerateArrayResult<z.infer<TSchema>>>;

  // render the template without calling the LLM (useful for debugging)
  render(vars: TemplateVars): string;
}

// createTemplate binds a reusable prompt template to a schema + provider config.
//
// Usage:
//   const analyzeDoc = createTemplate({
//     template: "Analyze this {{docType}} from {{company}}:\n\n{{content}}",
//     schema: AnalysisSchema,
//     client: openai,
//     model: "gpt-4o-mini",
//   });
//
//   const { data } = await analyzeDoc.run({ docType: "invoice", company: "Acme", content: "..." });

export function createTemplate<TSchema extends ZodLike>(
  config: TemplateConfig<TSchema>
): BoundTemplate<TSchema> {
  const { template, ...generateConfig } = config;

  function render(vars: TemplateVars): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      if (!(key in vars)) {
        throw new Error(`Template variable "{{${key}}}" not provided`);
      }
      return String(vars[key]);
    });
  }

  return {
    render,

    async run(vars, overrides = {}) {
      const prompt = render(vars);
      return generate({ ...generateConfig, ...overrides, prompt } as GenerateOptions<TSchema>);
    },

    async runArray(vars, overrides = {}) {
      const prompt = render(vars);
      return generateArray({
        ...generateConfig,
        ...overrides,
        prompt,
      } as GenerateArrayOptions<TSchema>);
    },
  };
}
