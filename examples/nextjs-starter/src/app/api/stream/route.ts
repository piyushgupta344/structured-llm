import { NextRequest } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { generateStream } from "structured-llm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SummarySchema = z.object({
  title: z.string(),
  executiveSummary: z.string(),
  keyPoints: z.array(z.string()),
  actionItems: z.array(z.string()),
  sentiment: z.enum(["positive", "neutral", "negative"]),
});

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const llmStream = generateStream({
          client: openai,
          model: "gpt-4o-mini",
          schema: SummarySchema,
          prompt: text,
          systemPrompt: "Summarize this text into a structured report.",
        });

        for await (const event of llmStream) {
          const chunk = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const error = `data: ${JSON.stringify({ error: String(err) })}\n\n`;
        controller.enqueue(encoder.encode(error));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
