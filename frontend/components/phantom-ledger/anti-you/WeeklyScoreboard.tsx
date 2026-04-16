"use client";

import type { AntiYouState } from "@/lib/stores/anti-you-store";
import { formatCurrency, formatDate } from "@/lib/utils/formatters";

type WeeklyResult = AntiYouState["weeklyResults"][0];

interface WeeklyScoreboardProps {
  results: WeeklyResult[];
}

export function WeeklyScoreboard({ results }: WeeklyScoreboardProps) {
  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide mb-4">
        Weekly Results
      </h3>
      <div className="space-y-2">
        {results.slice(0, 8).map((result) => (
          <div
            key={result.weekStart}
            className="flex items-center gap-4 p-3 rounded-xl bg-white/3 border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all"
          >
            <div className="text-[10px] text-[var(--color-text-muted)] w-24 flex-shrink-0">
              {formatDate(result.weekStart)}
            </div>

            <div className="flex-1 flex items-center gap-3">
              <span
                className={`text-xs font-bold ${
                  result.yourPnl >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                }`}
              >
                You: {formatCurrency(result.yourPnl)}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">vs</span>
              <span
                className={`text-xs font-bold ${
                  result.antiYouPnl >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                }`}
              >
                Shadow: {formatCurrency(result.antiYouPnl)}
              </span>
            </div>

            <div
              className={`px-3 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${
                result.winner === "you"
                  ? "bg-[var(--color-success-dim)] text-[var(--color-success)] border border-[var(--color-success)]/20"
                  : result.winner === "anti-you"
                  ? "bg-[var(--color-anti-you-dim)] text-[var(--color-anti-you)] border border-[var(--color-anti-you)]/20"
                  : "bg-white/5 text-[var(--color-text-muted)] border border-[var(--color-border)]"
              }`}
            >
              {result.winner === "you"
                ? "You Won"
                : result.winner === "anti-you"
                ? "Shadow Won"
                : "Draw"}
            </div>

            <div
              className={`text-xs font-bold tabular-nums w-20 text-right ${
                result.delta >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
              }`}
            >
              {result.delta >= 0 ? "+" : ""}{formatCurrency(result.delta)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
