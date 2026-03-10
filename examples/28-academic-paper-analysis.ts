// Academic paper analysis — extract metadata, contributions, and limitations
// Run: OPENAI_API_KEY=... npx tsx examples/28-academic-paper-analysis.ts

import OpenAI from "openai";
import { z } from "zod";
import { generateMultiSchema } from "../src/index.js";

const client = new OpenAI();

const MetadataSchema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  year: z.number().int().optional(),
  venue: z.string().optional().describe("Conference, journal, or arxiv"),
  doi: z.string().optional(),
  keywords: z.array(z.string()),
  researchArea: z.string(),
  problemStatement: z.string(),
});

const ContentSchema = z.object({
  mainContributions: z.array(z.string()),
  methodology: z.string(),
  datasets: z.array(z.string()),
  benchmarks: z.array(
    z.object({
      metric: z.string(),
      value: z.string(),
      comparedTo: z.string().optional(),
    })
  ),
  limitations: z.array(z.string()),
  futureWork: z.array(z.string()),
  relatedWork: z.array(z.string()),
  tldr: z.string().max(300),
  practicalApplications: z.array(z.string()),
});

const paper = `
Title: Attention Is All You Need
Authors: Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones,
         Aidan N. Gomez, Łukasz Kaiser, Illia Polosukhin
Venue: NeurIPS 2017

Abstract:
The dominant sequence transduction models are based on complex recurrent or
convolutional neural networks that include an encoder and a decoder. The best
performing models also connect the encoder and decoder through an attention mechanism.
We propose a new simple network architecture, the Transformer, based solely on
attention mechanisms, dispensing with recurrence and convolutions entirely.
Experiments on two machine translation tasks show these models to be superior in
quality while being more parallelizable and requiring significantly less time to train.
Our model achieves 28.4 BLEU on the WMT 2014 English-to-German translation task,
improving over the existing best results, including ensembles, by over 2 BLEU.
On the WMT 2014 English-to-French translation task, our model establishes a new
single-model state-of-the-art BLEU score of 41.8 after training for 3.5 days on
eight GPUs, a small fraction of the training costs of the best models from the literature.

1. Introduction
Recurrent neural networks have been firmly established as state of the art approaches
in sequence modeling. The attention mechanism has become an integral part of compelling
sequence modeling allowing modeling of dependencies without regard to their distance.
In this work we propose the Transformer, a model architecture eschewing recurrence
and instead relying entirely on an attention mechanism.

The Transformer allows for significantly more parallelization. Multi-head attention
allows the model to jointly attend to information from different representation
subspaces at different positions.

Limitations: The model requires O(n²) memory with respect to sequence length.
Performance on longer sequences may degrade. The model is also computationally
expensive to train from scratch.

Future work includes applying the Transformer to other domains including images,
audio, and video, and to generative models.
`;

async function main() {
  console.log("Analyzing paper...\n");

  const { results, totalUsage } = await generateMultiSchema({
    client,
    model: "gpt-4o-mini",
    prompt: paper,
    systemPrompt: "You are an expert academic researcher. Extract precise information from this paper.",
    schemas: {
      meta: MetadataSchema,
      content: ContentSchema,
    },
  });

  if (results.meta.data) {
    const m = results.meta.data;
    console.log(`Title: ${m.title}`);
    console.log(`Authors: ${m.authors.slice(0, 3).join(", ")}${m.authors.length > 3 ? " et al." : ""}`);
    console.log(`Venue: ${m.venue ?? "N/A"} ${m.year ?? ""}`);
    console.log(`Area: ${m.researchArea}`);
    console.log(`Keywords: ${m.keywords.join(", ")}`);
    console.log(`\nProblem: ${m.problemStatement}`);
  }

  if (results.content.data) {
    const c = results.content.data;
    console.log(`\nTL;DR: ${c.tldr}`);

    console.log(`\nMain Contributions:`);
    c.mainContributions.forEach((contrib) => console.log(`  • ${contrib}`));

    if (c.benchmarks.length > 0) {
      console.log(`\nBenchmark Results:`);
      c.benchmarks.forEach((b) => {
        console.log(`  ${b.metric}: ${b.value}${b.comparedTo ? ` vs ${b.comparedTo}` : ""}`);
      });
    }

    console.log(`\nLimitations:`);
    c.limitations.forEach((l) => console.log(`  • ${l}`));

    if (c.practicalApplications.length > 0) {
      console.log(`\nPractical Applications:`);
      c.practicalApplications.forEach((a) => console.log(`  • ${a}`));
    }
  }

  if (totalUsage) {
    console.log(`\nTokens: ${totalUsage.totalTokens} (~$${totalUsage.estimatedCostUsd.toFixed(5)})`);
  }
}

main().catch(console.error);
