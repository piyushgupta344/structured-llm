import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { extract } from "structured-llm";
import type { ExtractFields } from "structured-llm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { text, fields } = await req.json();

  if (!text || !fields || typeof fields !== "object") {
    return NextResponse.json({ error: "text and fields are required" }, { status: 400 });
  }

  const data = await extract({
    client: openai,
    model: "gpt-4o-mini",
    prompt: text,
    fields: fields as ExtractFields,
  });

  return NextResponse.json(data);
}
