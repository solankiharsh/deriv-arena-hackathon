'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, ChevronDown, ChevronUp,
  TrendingUp, Brain, Target, LogOut, AlertTriangle, FileText,
} from 'lucide-react';
import { useTradeStore } from '@/lib/stores/trade-store';
import { uniqueId } from '@/lib/utils/unique-id';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface GameAIChatPanelProps {
  gameScore: number;
  percentile: number;
  gameMode: string;
  gameModeName: string;
  gameModeDescription: string;
  templateDescription: string;
}

const QUICK_ACTIONS = [
  { label: "Best move?", icon: Target, question: "What's my best move right now given the current trend and my session stats?" },
  { label: "Am I on tilt?", icon: AlertTriangle, question: "Am I showing signs of tilt? Analyze my recent win/loss pattern and streaks." },
  { label: "Read the trend", icon: TrendingUp, question: "What is the current price trend? Give me a quick technical read." },
  { label: "Hold or exit?", icon: LogOut, question: "Should I hold my current position or exit early? Analyze the entry vs current price.", requiresPosition: true },
  { label: "Where am I leaking?", icon: Brain, question: "Where am I leaking edge? What behavioral weaknesses do you see in my session?" },
  { label: "Session summary", icon: FileText, question: "Give me a quick summary of my session performance so far." },
] as const;

export default function GameAIChatPanel({
  gameScore,
  percentile,
  gameMode,
  gameModeName,
  gameModeDescription,
  templateDescription,
}: GameAIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const tradeState = useTradeStore();

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const buildPayload = useCallback((question: string) => {
    const { selectedAsset, availableSymbols, selectedDirection, selectedStake,
      sessionPnl, sessionTrades, sessionWins, winStreak, lossStreak,
      activePosition, tradeHistory } = tradeState;

    const displayName = availableSymbols.find(
      (s) => s.symbol === selectedAsset
    )?.display_name ?? selectedAsset;

    return {
      question,
      symbol: selectedAsset,
      symbolDisplayName: displayName,
      recentPrices: [] as number[],
      direction: selectedDirection,
      stake: selectedStake,
      sessionPnl,
      sessionTrades,
      sessionWins,
      winStreak,
      lossStreak,
      activePosition: activePosition ? {
        direction: activePosition.direction,
        stake: activePosition.stake,
        entrySpot: activePosition.entrySpot,
        currentSpot: activePosition.currentSpot,
        currentPnl: activePosition.currentPnl,
      } : undefined,
      gameScore,
      percentile,
      tradeHistory: tradeHistory.slice(0, 20).map((t) => ({
        asset: t.asset,
        direction: t.direction,
        stake: t.stake,
        pnl: t.pnl ?? 0,
        status: t.status,
      })),
      gameMode,
      gameModeName,
      gameModeDescription,
      templateDescription,
    };
  }, [tradeState, gameScore, percentile, gameMode, gameModeName, gameModeDescription, templateDescription]);

  const sendMessage = useCallback(async (question: string) => {
    if (isLoading || !question.trim()) return;

    const userMsg: ChatMessage = {
      id: uniqueId('user'),
      role: 'user',
      content: question.trim(),
      timestamp: Date.now(),
    };

    const assistantId = uniqueId('ai');
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsLoading(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = buildPayload(question);
      const res = await fetch('/api/claude/game-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = res.status === 429 ? 'Rate limit reached. Wait a moment.' : 'AI service unavailable.';
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: errText } : m)
        );
        setIsLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const snapshot = accumulated;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId ? { ...m, content: snapshot } : m)
        );
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: 'Failed to get response.' } : m)
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, buildPayload]);

  const hasPosition = tradeState.activePosition !== null;

  return (
    <div className="bg-card border border-border rounded-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-white/[0.02] transition-colors"
      >
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary">
          AI Analytics
        </h3>
        <span className="ml-auto text-text-muted">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Quick action chips */}
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((action) => {
                if ('requiresPosition' in action && action.requiresPosition && !hasPosition) return null;
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.question)}
                    disabled={isLoading}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-mono rounded-full
                      bg-white/[0.04] border border-border hover:border-purple-500/30 hover:bg-purple-500/5
                      text-text-secondary hover:text-text-primary transition-all disabled:opacity-50"
                  >
                    <Icon className="w-3 h-3" />
                    {action.label}
                  </button>
                );
              })}
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="max-h-[300px] overflow-y-auto px-3 space-y-2 scrollbar-thin"
            >
              {messages.length === 0 && (
                <div className="py-6 text-center text-text-muted text-xs">
                  Ask anything about your game...
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'text-right'
                      : 'text-left'
                  }`}
                >
                  <div
                    className={`inline-block max-w-[95%] px-2.5 py-1.5 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-purple-500/15 text-purple-200 border border-purple-500/20'
                        : 'bg-white/[0.03] text-text-secondary border border-border'
                    }`}
                  >
                    {msg.role === 'assistant' && !msg.content && isLoading ? (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="p-2 border-t border-border">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage(input);
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your game..."
                  maxLength={500}
                  disabled={isLoading}
                  className="flex-1 bg-white/[0.03] border border-border rounded-lg px-2.5 py-1.5
                    text-xs text-text-primary placeholder:text-text-muted
                    focus:outline-none focus:border-purple-500/40 transition-colors disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="p-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20
                    hover:bg-purple-500/20 text-purple-400 transition-all disabled:opacity-30"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
