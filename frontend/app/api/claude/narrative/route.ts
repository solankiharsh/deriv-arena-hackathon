import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { buildNarrativePrompt } from "@/lib/ai/prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const TradeSchema = z.object({
  asset: z.string().max(20),
  direction: z.enum(["CALL", "PUT"]),
  stake: z.number().min(0).max(100000),
  pnl: z.number(),
  tiltScoreAtEntry: z.number().min(0).max(100),
  wasRevengeFlag: z.boolean(),
  heldToExpiry: z.boolean(),
  premortemText: z.string().max(500).optional(),
});

const PhantomSchema = z.object({
  asset: z.string().max(20),
  confidenceTier: z.enum(["GLANCED", "WEIGHED", "HOVERED", "BAILED"]),
  finalPnl: z.number().optional(),
  type: z.enum(["abandoned", "continuation", "anti-you", "early_exit"]),
});

const RequestSchema = z.object({
  trades: z.array(TradeSchema).max(100),
  phantoms: z.array(PhantomSchema).max(200),
  tiltPeak: z.number().min(0).max(100),
  sessionPnl: z.number(),
  phantomPnl: z.number(),
  antiYouPnl: z.number(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`narrative:${ip}`, 5, 60000)) {
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
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
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
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
