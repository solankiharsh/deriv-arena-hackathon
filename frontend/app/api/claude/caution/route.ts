import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { buildCautionPrompt } from "@/lib/ai/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RequestSchema = z.object({
  tiltScore: z.number().min(0).max(100),
  consecutiveLosses: z.number().min(0).max(50),
  lossAmountLast3: z.number().min(0),
  historicalPatternMessage: z.string().max(200),
  asset: z.string().max(20),
  proposedStake: z.number().min(0).max(100000),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 30) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`caution:${ip}`)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request data" }, { status: 400 });
  }

  const prompt = buildCautionPrompt(parsed.data);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? "";
    return NextResponse.json({ caution: text });
  } catch {
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
