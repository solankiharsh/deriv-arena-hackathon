import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { buildNarrativePrompt } from "@/lib/ai/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RequestSchema = z.object({
  trades: z.array(z.object({
    asset: z.string().max(20),
    direction: z.enum(["CALL", "PUT"]),
    stake: z.number().min(0).max(100000),
    pnl: z.number(),
    tiltScoreAtEntry: z.number().min(0).max(100),
    wasRevengeFlag: z.boolean(),
    heldToExpiry: z.boolean(),
    premortemText: z.string().max(500).optional(),
  })).max(100),
  phantoms: z.array(z.object({
    asset: z.string().max(20),
    confidenceTier: z.enum(["GLANCED", "WEIGHED", "HOVERED", "BAILED"]),
    finalPnl: z.number().optional(),
    type: z.enum(["abandoned", "continuation", "anti-you", "early_exit"]),
  })).max(200),
  tiltPeak: z.number().min(0).max(100),
  sessionPnl: z.number(),
  phantomPnl: z.number(),
  antiYouPnl: z.number(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 3) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`journal:${ip}`)) {
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

  const prompt = buildNarrativePrompt(parsed.data);

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const narrative = response.choices[0]?.message?.content ?? "";
    return NextResponse.json({
      narrative,
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
