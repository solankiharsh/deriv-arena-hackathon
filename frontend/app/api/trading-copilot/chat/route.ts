'use strict';

import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { computeMarketAnalysis } from '@/lib/trading-copilot/market-analysis';
import {
  TRADING_COPILOT_SYSTEM_PROMPT,
  TRADING_COPILOT_TOOLS,
} from '@/lib/trading-copilot/openai-tools';
import {
  consumeTradingCopilotCredit,
  getTradingCopilotEntitlement,
} from '@/lib/trading-copilot/entitlements';

const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 10_000;
const MAX_ITERATIONS = 5;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_MAX) return false;
  entry.count += 1;
  return true;
}

const WIDGET_TOOL_NAMES = new Set([
  'show_bar_chart',
  'show_line_chart',
  'show_pie_chart',
  'show_metric_card',
  'show_data_table',
  'show_flow_diagram',
  'show_trading_chart',
  'place_trade',
  'get_portfolio',
  'get_signals',
  'show_leaderboard',
]);

const ANALYSIS_TOOL_NAMES = new Set(['analyze_market']);

type WidgetType =
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'metric_card'
  | 'data_table'
  | 'flow_diagram'
  | 'trading_chart'
  | 'trade_ticket'
  | 'portfolio'
  | 'signal_card'
  | 'leaderboard';

const TOOL_TO_WIDGET: Record<string, WidgetType> = {
  show_bar_chart: 'bar_chart',
  show_line_chart: 'line_chart',
  show_pie_chart: 'pie_chart',
  show_metric_card: 'metric_card',
  show_data_table: 'data_table',
  show_flow_diagram: 'flow_diagram',
  show_trading_chart: 'trading_chart',
  place_trade: 'trade_ticket',
  get_portfolio: 'portfolio',
  get_signals: 'signal_card',
  show_leaderboard: 'leaderboard',
};

function toolNameToWidgetType(name: string): WidgetType {
  return TOOL_TO_WIDGET[name] ?? (name.replace('show_', '') as WidgetType);
}

function sseEncode(encoder: TextEncoder, data: string): Uint8Array {
  return encoder.encode(`data: ${data}\n\n`);
}

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(MAX_CONTENT_LENGTH),
      }),
    )
    .min(1)
    .max(MAX_MESSAGES),
});

async function executeToolForModel(
  name: string,
  rawArgs: string,
): Promise<{ toolContent: string; widgetEvents: Array<{ toolCallId: string; widgetType: WidgetType; data: unknown }> }> {
  const widgetEvents: Array<{ toolCallId: string; widgetType: WidgetType; data: unknown }> = [];

  let parsedArgs: Record<string, unknown> = {};
  try {
    parsedArgs = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    return { toolContent: JSON.stringify({ error: 'Invalid tool arguments JSON' }), widgetEvents };
  }

  if (ANALYSIS_TOOL_NAMES.has(name)) {
    try {
      const symbol = String(parsedArgs.symbol ?? '');
      const timeframe = parsedArgs.timeframe != null ? String(parsedArgs.timeframe) : undefined;
      const indicators = Array.isArray(parsedArgs.indicators)
        ? (parsedArgs.indicators as unknown[]).map((x) => String(x))
        : undefined;
      const result = await computeMarketAnalysis(symbol, timeframe, indicators);
      return { toolContent: JSON.stringify(result), widgetEvents };
    } catch (err) {
      return {
        toolContent: JSON.stringify({
          error: err instanceof Error ? err.message : 'Analysis failed',
        }),
        widgetEvents,
      };
    }
  }

  if (WIDGET_TOOL_NAMES.has(name)) {
    widgetEvents.push({
      toolCallId: '',
      widgetType: toolNameToWidgetType(name),
      data: parsedArgs,
    });
    return { toolContent: JSON.stringify({ rendered: true }), widgetEvents };
  }

  if (name === 'get_portfolio') {
    return {
      toolContent: JSON.stringify({
        message:
          'Live portfolio positions are not attached to this chat session. Offer general risk and position-sizing guidance.',
      }),
      widgetEvents,
    };
  }

  if (name === 'show_leaderboard') {
    return {
      toolContent: JSON.stringify({
        message: 'Leaderboard data is not loaded in this view. Encourage healthy competition and discipline metrics.',
      }),
      widgetEvents,
    };
  }

  return { toolContent: JSON.stringify({ rendered: true }), widgetEvents };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const uid = session.uid;

    if (!checkRateLimit(`copilot:${uid}`)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429 });
    }

    const ent = await getTradingCopilotEntitlement(uid);
    if (!ent.ok) {
      return new Response(JSON.stringify({ error: 'Trading Copilot is not active for this account.' }), {
        status: 403,
      });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
    }

    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY?.trim()) {
      return new Response(
        JSON.stringify({
          error:
            'OpenAI is not configured. Set OPENAI_API_KEY in frontend/.env.local (or your deployment environment) and restart the Next.js dev server.',
        }),
        { status: 503 },
      );
    }

    const consumed = await consumeTradingCopilotCredit(uid);
    if (!consumed) {
      return new Response(JSON.stringify({ error: 'No Trading Copilot credits remaining.' }), {
        status: 403,
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.TRADING_COPILOT_MODEL || 'gpt-4o-mini';

    const encoder = new TextEncoder();
    const userTurnMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: TRADING_COPILOT_SYSTEM_PROMPT },
      ...parsed.data.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown> | string) => {
          const payload = typeof obj === 'string' ? obj : JSON.stringify(obj);
          controller.enqueue(sseEncode(encoder, payload));
        };

        try {
        const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          ...userTurnMessages,
        ];

        let iterations = 0;
        while (iterations < MAX_ITERATIONS) {
          iterations += 1;

          const stream = await openai.chat.completions.create({
            model,
            messages: conversationMessages,
            tools: TRADING_COPILOT_TOOLS,
            stream: true,
            max_completion_tokens: 4096,
          });

          let accumulatedContent = '';
          let finishReason: string | null = null;
          const toolCallBuckets: Record<
            number,
            { id: string; name: string; arguments: string }
          > = {};

          for await (const chunk of stream) {
            const choice = chunk.choices[0];
            if (!choice) continue;

            if (choice.finish_reason) {
              finishReason = choice.finish_reason;
            }

            const delta = choice.delta;
            if (delta.content) {
              accumulatedContent += delta.content;
              send({ type: 'text_delta', content: delta.content });
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallBuckets[idx]) {
                  toolCallBuckets[idx] = { id: '', name: '', arguments: '' };
                }
                if (tc.id) toolCallBuckets[idx].id = tc.id;
                if (tc.function?.name) {
                  toolCallBuckets[idx].name = tc.function.name;
                }
                if (tc.function?.arguments) {
                  toolCallBuckets[idx].arguments += tc.function.arguments;
                }
              }
            }
          }

          const toolIndices = Object.keys(toolCallBuckets)
            .map(Number)
            .sort((a, b) => a - b);

          if (finishReason === 'tool_calls' && toolIndices.length > 0) {
            const assistantToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall[] =
              [];

            for (const idx of toolIndices) {
              const tc = toolCallBuckets[idx];
              if (!tc.id || !tc.name) continue;

              if (WIDGET_TOOL_NAMES.has(tc.name)) {
                try {
                  const args = JSON.parse(tc.arguments || '{}');
                  send({
                    type: 'widget',
                    toolCallId: tc.id,
                    widgetType: toolNameToWidgetType(tc.name),
                    data: args,
                  });
                } catch {
                  send({
                    type: 'text_delta',
                    content: `\n[Failed to render ${tc.name}]\n`,
                  });
                }
              }

              assistantToolCalls.push({
                id: tc.id,
                type: 'function',
                function: {
                  name: tc.name,
                  arguments: tc.arguments || '{}',
                },
              });
            }

            if (assistantToolCalls.length === 0) {
              break;
            }

            conversationMessages.push({
              role: 'assistant',
              content: accumulatedContent || null,
              tool_calls: assistantToolCalls,
            });

            for (const tcCall of assistantToolCalls) {
              const name = tcCall.function.name;
              const rawArgs = tcCall.function.arguments || '{}';
              const { toolContent } = await executeToolForModel(name, rawArgs);
              conversationMessages.push({
                role: 'tool',
                tool_call_id: tcCall.id,
                content: toolContent,
              });
            }

            continue;
          }

          break;
        }

        controller.enqueue(sseEncode(encoder, '[DONE]'));
        controller.close();
        } catch (err) {
          console.error('[trading-copilot/chat]', err);
          send({ type: 'error', message: 'Something went wrong. Please try again.' });
          controller.enqueue(sseEncode(encoder, '[DONE]'));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    console.error('[trading-copilot/chat] outer', err);
    return new Response(JSON.stringify({ error: 'Trading Copilot request failed.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
