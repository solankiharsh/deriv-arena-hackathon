"use client";

import { BarChart3, TrendingUp, Shield, AlertCircle, Scale } from "lucide-react";
import type { usePhantomStore } from "@/lib/stores/phantom-store";
import { formatCurrency } from "@/lib/utils/formatters";
import { CONFIDENCE_TIER_COLORS, CONFIDENCE_TIER_LABELS } from "@/lib/engines/phantom-capture";

type PhantomAnalyticsData = ReturnType<typeof usePhantomStore.getState>["analytics"];

interface PhantomAnalyticsProps {
  analytics: PhantomAnalyticsData;
}

const TIERS = ["GLANCED", "WEIGHED", "HOVERED", "BAILED"] as const;

const TIER_TOOLTIPS: Record<string, string> = {
  GLANCED: "You barely looked at this setup before moving on",
  WEIGHED: "You seriously considered the trade but decided against it",
  HOVERED: "Your cursor was on the button — you were about to click",
  BAILED: "You were going to trade but backed out at the very last moment",
};

export function PhantomAnalytics({ analytics }: PhantomAnalyticsProps) {
  const netEdge = analytics.smartAvoidanceValue - analytics.hesitationCost;
  const netEdgePositive = netEdge >= 0;

  const winningPhantomCount = Object.values(analytics.assetPerformance).reduce((s, p) => s + p.wins, 0);
  const losingPhantomCount = Object.values(analytics.assetPerformance).reduce((s, p) => s + p.losses, 0);

  const avgHesitationCost = winningPhantomCount > 0 ? analytics.hesitationCost / winningPhantomCount : 0;
  const avgAvoidanceSaved = losingPhantomCount > 0 ? analytics.smartAvoidanceValue / losingPhantomCount : 0;

  return (
    <div className="space-y-4 sticky top-6">
      {/* Net Behavioral Edge */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Scale size={14} className={netEdgePositive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"} />
          <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            Net Behavioral Edge
          </h3>
        </div>
        <div className={`text-2xl font-bold mb-1 ${netEdgePositive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}>
          {netEdgePositive ? "+" : ""}{formatCurrency(netEdge)}
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed">
          {netEdgePositive
            ? "Your instincts are saving you more than your hesitation is costing. Keep trusting the filter."
            : "Your hesitation is costing more than your avoidance is saving. Commit to your high-conviction setups."}
        </p>
      </div>

      {/* Hesitation Cost */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle size={14} className="text-[var(--color-danger)]" />
          <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            Hesitation Cost
          </h3>
        </div>
        <div className="text-2xl font-bold text-[var(--color-danger)] mb-1">
          -{formatCurrency(analytics.hesitationCost)}
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed mb-2">
          Total profit from phantom trades that won — money you left on the table by not trading.
        </p>
        <div className="flex items-center justify-between text-[10px] py-1.5 border-t border-[var(--color-border)]">
          <span className="text-[var(--color-text-muted)]">Winning phantoms</span>
          <span className="font-semibold text-[var(--color-text)]">{winningPhantomCount}</span>
        </div>
        {winningPhantomCount > 0 && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--color-text-muted)]">Avg profit per phantom</span>
            <span className="font-semibold text-[var(--color-danger)]">-{formatCurrency(avgHesitationCost)}</span>
          </div>
        )}
      </div>

      {/* Smart Avoidance */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} className="text-[var(--color-success)]" />
          <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            Smart Avoidances
          </h3>
        </div>
        <div className="text-2xl font-bold text-[var(--color-success)] mb-1">
          +{formatCurrency(analytics.smartAvoidanceValue)}
        </div>
        <p className="text-[10px] text-[var(--color-text-muted)] leading-relaxed mb-2">
          Total losses from phantom trades that lost — money you saved by not trading.
        </p>
        <div className="flex items-center justify-between text-[10px] py-1.5 border-t border-[var(--color-border)]">
          <span className="text-[var(--color-text-muted)]">Losing phantoms avoided</span>
          <span className="font-semibold text-[var(--color-text)]">{analytics.smartAvoidanceCount}</span>
        </div>
        {losingPhantomCount > 0 && (
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--color-text-muted)]">Avg loss avoided per phantom</span>
            <span className="font-semibold text-[var(--color-success)]">+{formatCurrency(avgAvoidanceSaved)}</span>
          </div>
        )}
      </div>

      {/* Win Rate by Tier */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={14} className="text-[var(--color-phantom)]" />
          <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            Win Rate by Confidence
          </h3>
        </div>
        <div className="space-y-3">
          {TIERS.map((tier) => {
            const rate = analytics.winRateByTier[tier] ?? 0;
            return (
              <div key={tier} title={TIER_TOOLTIPS[tier]}>
                <div className="flex justify-between text-[10px] mb-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-semibold"
                      style={{ color: CONFIDENCE_TIER_COLORS[tier] }}
                    >
                      {CONFIDENCE_TIER_LABELS[tier] ?? tier}
                    </span>
                    <span className="text-[8px] text-[var(--color-text-muted)]">
                      {TIER_TOOLTIPS[tier]}
                    </span>
                  </div>
                  <span className="text-[var(--color-text-muted)] tabular-nums">{rate.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/6 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${rate}%`,
                      background: CONFIDENCE_TIER_COLORS[tier],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {analytics.winRateByTier["BAILED"] && analytics.winRateByTier["BAILED"] > 60 && (
          <div className="mt-3 p-2 rounded-lg bg-[var(--color-danger-dim)] border border-[var(--color-danger)]/20">
            <p className="text-[9px] text-[var(--color-danger)] font-semibold">
              Your Bailed phantoms have a {analytics.winRateByTier["BAILED"].toFixed(0)}% win rate.
              The trades you almost take ARE your best trades.
            </p>
          </div>
        )}
      </div>

      {/* Asset Performance */}
      {Object.keys(analytics.assetPerformance).length > 0 && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-[var(--color-real)]" />
            <h3 className="text-xs font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
              Asset Phantom Performance
            </h3>
          </div>
          <div className="space-y-2">
            {Object.entries(analytics.assetPerformance)
              .sort((a, b) => b[1].pnl - a[1].pnl)
              .slice(0, 5)
              .map(([asset, perf]) => (
                <div
                  key={asset}
                  className="flex items-center justify-between py-1.5 border-b border-[var(--color-border)] last:border-0"
                >
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)]">
                      {asset}
                    </div>
                    <div className="text-[9px] text-[var(--color-text-muted)]">
                      {perf.wins}W / {perf.losses}L
                    </div>
                  </div>
                  <div
                    className={`text-xs font-bold ${
                      perf.pnl >= 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                    }`}
                  >
                    {formatCurrency(perf.pnl)}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
