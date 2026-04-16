"use client";

import { useTradeStore } from "@/lib/stores/trade-store";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { formatCurrency } from "@/lib/utils/formatters";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { cn } from "@/lib/utils/cn";

export function SessionStats() {
  const { sessionPnl, sessionTrades, sessionWins, winStreak } = useTradeStore();
  const { analytics } = usePhantomStore();
  const { score: tiltScore, history } = useTiltStore();

  const winRate = sessionTrades > 0 ? (sessionWins / sessionTrades) * 100 : 0;
  const tiltPeak = history.length > 0 ? Math.max(...history.map((h) => h.score)) : 0;

  const stats = [
    {
      label: "Session P&L",
      value: formatCurrency(sessionPnl),
      sub: `${sessionTrades} trades`,
      color: sessionPnl >= 0 ? "var(--color-success)" : "var(--color-danger)",
    },
    {
      label: "Win Rate",
      value: `${winRate.toFixed(0)}%`,
      sub: `${sessionWins}W / ${sessionTrades - sessionWins}L`,
      color: winRate >= 50 ? "var(--color-success)" : "var(--color-danger)",
    },
    {
      label: "Phantom P&L",
      value: formatCurrency(analytics.totalPhantomPnl),
      sub: `${analytics.smartAvoidanceCount} smart saves`,
      color: analytics.totalPhantomPnl >= 0 ? "var(--color-success)" : "var(--color-danger)",
    },
    {
      label: "Tilt Peak",
      value: `${tiltPeak}/100`,
      sub: `Current: ${tiltScore}`,
      color:
        tiltPeak > 60
          ? "var(--color-danger)"
          : tiltPeak > 40
          ? "var(--color-warning)"
          : "var(--color-success)",
    },
    {
      label: "Win Streak",
      value: `${winStreak}R`,
      sub: winStreak >= 3 ? "On fire 🔥" : "Keep going",
      color: winStreak >= 3 ? "var(--color-warning)" : "var(--color-text-secondary)",
    },
    {
      label: "Psychology Tax",
      value: formatCurrency(-analytics.hesitationCost),
      sub: "Missed phantom gains",
      color: "var(--color-phantom)",
    },
  ];

  return (
    <div className="glass rounded-2xl p-5">
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide mb-4">
        Session Overview
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-3 rounded-xl bg-white/3 border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-all card-hover"
          >
            <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
              {stat.label}
            </div>
            <div
              className="text-base font-bold tabular-nums leading-none"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
            <div className="text-[9px] text-[var(--color-text-muted)] mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
