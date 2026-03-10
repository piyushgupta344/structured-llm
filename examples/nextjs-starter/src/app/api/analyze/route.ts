import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { generate } from "structured-llm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const AnalysisSchema = z.object({
  sentiment: z.enum(["positive", "negative", "neutral"]),
  score: z.number().min(0).max(1),
  summary: z.string(),
  keyPoints: z.array(z.string()),
  topics: z.array(z.string()),
  readingGrade: z.enum(["simple", "moderate", "complex"]),
});

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const { data, usage } = await generate({
    client: openai,
    model: "gpt-4o-mini",
    schema: AnalysisSchema,
    prompt: text,
    systemPrompt: "Analyze this text and extract structured insights.",
    trackUsage: true,
  });

  return NextResponse.json({ data, usage });
}
