"use client";

import { useMemo } from "react";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { GlassCard } from "@/components/shared/GlassCard";

export function ChallengeCards() {
  const tradeHistory = useTradeStore((s) => s.tradeHistory);
  const winStreak = useTradeStore((s) => s.winStreak);
  const tiltScore = useTiltStore((s) => s.score);
  const challenges = useMemo(() => {
    const resolvedTrades = tradeHistory.filter((trade) => trade.status === "won" || trade.status === "lost");
    const heldWins = resolvedTrades.filter((trade) => trade.status === "won" && trade.heldToExpiry).length;
    const revengeTrades = resolvedTrades.filter((trade) => trade.wasRevengeFlag).length;
    return [
      {
        id: "hold-5",
        title: "Iron Patience",
        description: "Hold winning trades to full expiry",
        progress: Math.min(5, heldWins),
        target: 5,
        xp: 250,
        color: "var(--color-real)",
        deadline: "This week",
      },
      {
        id: "no-revenge",
        title: "Clear Mind",
        description: "Complete session with zero revenge trades",
        progress: revengeTrades === 0 ? 1 : 0,
        target: 1,
        xp: 150,
        color: "var(--color-success)",
        deadline: "Today",
      },
      {
        id: "streak-3",
        title: "Streak Builder",
        description: "Reach a 3-trade win streak while keeping tilt below 60",
        progress: tiltScore < 60 ? Math.min(3, winStreak) : 0,
        target: 3,
        xp: 300,
        color: "var(--color-phantom)",
        deadline: "This week",
      },
    ];
  }, [tradeHistory, winStreak, tiltScore]);

  return (
    <GlassCard className="p-5" hoverable>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
          Active Challenges
        </h3>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {challenges.length} active
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {challenges.map((challenge) => {
          const isComplete = challenge.progress >= challenge.target;

          return (
            <div
              key={challenge.id}
              className={`p-4 rounded-xl border transition-all card-hover ${
                isComplete
                  ? "border-[var(--color-success)]/30 bg-[var(--color-success-dim)]"
                  : "border-[var(--color-border)] bg-white/3"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-sm font-bold text-[var(--color-text-primary)]">
                    {challenge.title}
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    {challenge.deadline}
                  </div>
                </div>
                <div
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                  style={{
                    color: challenge.color,
                    background: `${challenge.color}20`,
                    border: `1px solid ${challenge.color}30`,
                  }}
                >
                  +{challenge.xp} XP
                </div>
              </div>

              <p className="text-[10px] text-[var(--color-text-secondary)] mb-3">
                {challenge.description}
              </p>

              <ProgressBar
                value={challenge.progress}
                max={challenge.target}
                color={challenge.color}
                showLabel
                label={`${challenge.progress}/${challenge.target}`}
              />
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
