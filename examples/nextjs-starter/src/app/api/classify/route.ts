import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { classify } from "structured-llm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { text, categories } = await req.json();

  if (!text || !Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json({ error: "text and categories are required" }, { status: 400 });
  }

  const result = await classify({
    client: openai,
    model: "gpt-4o-mini",
    prompt: text,
    options: categories,
    includeConfidence: true,
    includeReasoning: true,
  });

  return NextResponse.json(result);
}
