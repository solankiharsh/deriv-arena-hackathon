import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { buildGameAnalyticsPrompt } from "@/lib/ai/prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ActivePositionSchema = z.object({
  direction: z.string().max(10),
  stake: z.number().min(0).max(100000),
  entrySpot: z.number(),
  currentSpot: z.number(),
  currentPnl: z.number(),
});

const TradeHistoryItemSchema = z.object({
  asset: z.string().max(30),
  direction: z.string().max(10),
  stake: z.number().min(0).max(100000),
  pnl: z.number(),
  status: z.string().max(20),
});

const RequestSchema = z.object({
  question: z.string().min(1).max(500),
  symbol: z.string().max(30),
  symbolDisplayName: z.string().max(60),
  recentPrices: z.array(z.number()).max(50),
  direction: z.string().max(10),
  stake: z.number().min(0).max(100000),
  sessionPnl: z.number(),
  sessionTrades: z.number().int().min(0),
  sessionWins: z.number().int().min(0),
  winStreak: z.number().int().min(0),
  lossStreak: z.number().int().min(0),
  activePosition: ActivePositionSchema.optional(),
  gameScore: z.number(),
  percentile: z.number().min(0).max(100),
  tradeHistory: z.array(TradeHistoryItemSchema).max(20),
  gameMode: z.string().max(30),
  gameModeName: z.string().max(60),
  gameModeDescription: z.string().max(300),
  templateDescription: z.string().max(1000),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests = 15, windowMs = 60000): boolean {
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
  if (!checkRateLimit(`game-analytics:${ip}`, 15, 60000)) {
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

  const { question, ...context } = parsed.data;
  const prompt = buildGameAnalyticsPrompt(context, question);

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
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
