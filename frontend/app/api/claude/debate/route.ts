import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import {
  buildBullDebatePrompt,
  buildBearDebatePrompt,
  buildOwlDebatePrompt,
} from "@/lib/ai/prompts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const RequestSchema = z.object({
  asset: z.string().max(20),
  recentPrices: z.array(z.number()).max(50),
  priceChange: z.number(),
  timeOfDay: z.string().max(10),
});

const AgentResponseSchema = z.object({
  direction: z.enum(["CALL", "PUT"]),
  confidence: z.number().min(0).max(100),
  reasoning: z.string().max(200),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, max = 20, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

async function callAgent(
  prompt: string
): Promise<{ direction: "CALL" | "PUT"; confidence: number; reasoning: string } | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const validated = AgentResponseSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!checkRateLimit(`debate:${ip}`, 20, 60000)) {
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

  const { asset, recentPrices, priceChange, timeOfDay } = parsed.data;

  const [bull, bear, owl] = await Promise.all([
    callAgent(buildBullDebatePrompt({ asset, recentPrices, priceChange })),
    callAgent(buildBearDebatePrompt({ asset, recentPrices, priceChange })),
    callAgent(buildOwlDebatePrompt({ asset, recentPrices, priceChange, timeOfDay })),
  ]);

  const bullResult = bull ?? { direction: "CALL" as const, confidence: 50, reasoning: "Bullish momentum" };
  const bearResult = bear ?? { direction: "PUT" as const, confidence: 50, reasoning: "Bearish divergence" };
  const owlResult = owl ?? { direction: "CALL" as const, confidence: 40, reasoning: "Neutral macro context" };

  return NextResponse.json({
    bull: { ...bullResult, agent: "BULL" },
    bear: { ...bearResult, agent: "BEAR" },
    owl: { ...owlResult, agent: "OWL" },
  });
}
