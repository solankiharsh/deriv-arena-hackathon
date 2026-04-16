import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { buildRecommendationPrompt } from "@/lib/ai/prompts";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const RequestSchema = z.object({
  besScore: z.number().min(0).max(100),
  phantomEfficiency: z.number().min(0).max(100),
  exitIntelligence: z.number().min(0).max(100),
  tiltResistance: z.number().min(0).max(100),
  topLeak: z.string().max(100),
  antiYouDelta: z.number(),
  revengeTradeCount: z.number().min(0),
  earlyExitCount: z.number().min(0),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`rec:${ip}`)) {
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const prompt = buildRecommendationPrompt(parsed.data);

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new NextResponse(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch {
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
