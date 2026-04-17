'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { CopilotMessageParts } from '@/components/trading-copilot/CopilotMessageParts';
import { getCopilotDB } from '@/lib/trading-copilot/copilot-db';
import type { CopilotMessage, MessagePart, WidgetType } from '@/lib/trading-copilot/types';

function partsToApiContent(parts: MessagePart[]): string {
  return parts
    .filter((p): p is { type: 'text'; content: string } => p.type === 'text')
    .map((p) => p.content)
    .join('\n')
    .trim();
}

function generateTitle(messages: CopilotMessage[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New conversation';
  const t = partsToApiContent(first.parts);
  if (!t) return 'New conversation';
  if (t.length <= 48) return t;
  return `${t.slice(0, 48).trim()}…`;
}

export function CopilotChatView({
  conversationId,
  userId,
  initialMessages,
}: {
  conversationId: string;
  userId: string;
  initialMessages: CopilotMessage[];
}) {
  const [messages, setMessages] = useState<CopilotMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<CopilotMessage[]>(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setMessages(initialMessages);
    setInput('');
  }, [conversationId, initialMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  const persistConversation = useCallback(
    async (msgs: CopilotMessage[]) => {
      const db = getCopilotDB();
      const title = generateTitle(msgs);
      const now = Date.now();
      await db.conversations.put({
        id: conversationId,
        userId,
        title,
        updatedAt: now,
      });
      await db.messages.where('conversationId').equals(conversationId).delete();
      let t = now;
      for (const m of msgs) {
        t += 1;
        await db.messages.put({
          id: m.id,
          conversationId,
          userId,
          role: m.role,
          partsJson: JSON.stringify(m.parts),
          createdAt: t,
        });
      }
    },
    [conversationId, userId],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || streaming) return;

      const userMsg: CopilotMessage = {
        id: nanoid(),
        role: 'user',
        parts: [{ type: 'text', content: text }],
      };
      const assistantId = nanoid();
      const assistantMsg: CopilotMessage = {
        id: assistantId,
        role: 'assistant',
        parts: [],
      };

      const nextMessages = [...messagesRef.current, userMsg, assistantMsg];
      setMessages(nextMessages);
      setInput('');
      setStreaming(true);

      const apiPayload = nextMessages.slice(0, -1).map((m) => ({
        role: m.role,
        content: partsToApiContent(m.parts) || (m.role === 'assistant' ? '(assistant reply)' : ''),
      }));

      try {
        const res = await fetch('/api/trading-copilot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ messages: apiPayload }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => '');
          throw new Error(errText || `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const updateAssistant = (fn: (parts: MessagePart[]) => MessagePart[]) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, parts: fn(m.parts) } : m)),
          );
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';
          for (const block of chunks) {
            const line = block.trim();
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;
            let evt: { type?: string; content?: string; widgetType?: string; data?: unknown; message?: string };
            try {
              evt = JSON.parse(payload) as typeof evt;
            } catch {
              continue;
            }
            if (evt.type === 'text_delta' && evt.content) {
              updateAssistant((parts) => {
                const last = parts[parts.length - 1];
                if (last && last.type === 'text') {
                  return [...parts.slice(0, -1), { ...last, content: last.content + evt.content! }];
                }
                return [...parts, { type: 'text', content: evt.content! }];
              });
            } else if (evt.type === 'widget' && evt.widgetType && evt.data && typeof evt.data === 'object') {
              const toolCallId = (evt as { toolCallId?: string }).toolCallId ?? nanoid();
              updateAssistant((parts) => [
                ...parts,
                {
                  type: 'widget',
                  toolCallId,
                  widgetType: evt.widgetType as WidgetType,
                  data: evt.data as Record<string, unknown>,
                },
              ]);
            } else if (evt.type === 'error') {
              updateAssistant((parts) => [
                ...parts,
                { type: 'text', content: `\n\n_${evt.message ?? 'Error'}_\n` },
              ]);
            }
          }
        }

        setMessages((final) => {
          void persistConversation(final);
          return final;
        });
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [
                    {
                      type: 'text',
                      content: `_Could not complete the reply._ ${err instanceof Error ? err.message : ''}`,
                    },
                  ],
                }
              : m,
          ),
        );
      } finally {
        setStreaming(false);
      }
    },
    [input, streaming, persistConversation],
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-bg-primary">
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 max-w-3xl mx-auto w-full">
        {messages.length === 0 ? (
          <p className="text-text-muted text-center text-sm">
            Ask about markets, charts, or trade ideas. The assistant uses Deriv context and structured
            widgets.
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[95%] rounded-2xl px-4 py-3 border ${
                m.role === 'user'
                  ? 'bg-accent-primary/15 border-accent-primary/30 text-text-primary'
                  : 'bg-card border-border text-text-primary'
              }`}
            >
              <CopilotMessageParts parts={m.parts} />
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border p-4 bg-bg-secondary/80 backdrop-blur max-w-3xl mx-auto w-full"
      >
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Trading Copilot…"
            rows={2}
            className="flex-1 resize-none rounded-xl border border-border bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary/40"
            disabled={streaming}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
          />
          <Button
            type="submit"
            disabled={streaming || !input.trim()}
            className="bg-accent-primary text-black hover:brightness-110 shrink-0 h-10"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
