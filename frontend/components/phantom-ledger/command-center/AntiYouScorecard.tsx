"use client";

import { useAntiYouStore } from "@/lib/stores/anti-you-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { formatCurrency } from "@/lib/utils/formatters";
import { ProgressBar } from "@/components/shared/ProgressBar";
import Link from "next/link";

export function AntiYouScorecard() {
  const { antiYouSessionPnl, evolution } = useAntiYouStore();
  const { sessionPnl } = useTradeStore();

  const delta = sessionPnl - antiYouSessionPnl;
  const youWinning = sessionPnl > antiYouSessionPnl;

  const maxAbsPnl = Math.max(Math.abs(sessionPnl), Math.abs(antiYouSessionPnl), 1);
  const yourPercent = Math.max(0, Math.min(100, ((sessionPnl + maxAbsPnl) / (maxAbsPnl * 2)) * 100));
  const antiYouPercent = Math.max(0, Math.min(100, ((antiYouSessionPnl + maxAbsPnl) / (maxAbsPnl * 2)) * 100));

  return (
    <div className="glass rounded-2xl p-5 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
          Anti-You · LIVE
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-anti-you-dim)] text-[var(--color-anti-you)] border border-[var(--color-anti-you)]/20">
            {evolution.replace(/_/g, " ")}
          </span>
          <Link
            href="/anti-you"
            className="text-[10px] font-semibold text-[var(--color-anti-you)] hover:opacity-80 transition-opacity"
          >
            HQ →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* You */}
        <div className="text-center p-3 rounded-xl bg-[var(--color-real-dim)] border border-[var(--color-real)]/20">
          <div className="text-[10px] font-semibold text-[var(--color-real)] uppercase tracking-wider mb-1">
            YOU
          </div>
          <div
            className={`text-xl font-bold tabular-nums ${
              sessionPnl >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
            }`}
          >
            {formatCurrency(sessionPnl)}
          </div>
        </div>

        {/* Anti-You */}
        <div className="text-center p-3 rounded-xl bg-[var(--color-anti-you-dim)] border border-[var(--color-anti-you)]/20">
          <div className="text-[10px] font-semibold text-[var(--color-anti-you)] uppercase tracking-wider mb-1">
            ANTI-YOU
          </div>
          <div
            className={`text-xl font-bold tabular-nums ${
              antiYouSessionPnl >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
            }`}
          >
            {formatCurrency(antiYouSessionPnl)}
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-2 mb-4">
        <ProgressBar
          value={yourPercent}
          max={100}
          color="var(--color-real)"
          showLabel
          label="You"
        />
        <ProgressBar
          value={antiYouPercent}
          max={100}
          color="var(--color-anti-you)"
          showLabel
          label="Anti-You"
        />
      </div>

      {/* Delta */}
      <div className="text-center p-2 rounded-lg bg-white/3 border border-[var(--color-border)]">
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
          Session Delta
        </span>
        <div
          className={`text-base font-bold mt-0.5 ${
            youWinning ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
          }`}
        >
          {youWinning ? "+" : ""}{formatCurrency(delta)}
          <span className="text-[10px] ml-1 font-normal">
            {youWinning ? "you lead" : "shadow leads"}
          </span>
        </div>
      </div>
    </div>
  );
}
