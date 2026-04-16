"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils/formatters";
import { useTradeStore } from "@/lib/stores/trade-store";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { calculateNetPsychologyTax } from "@/lib/engines/behavioral-scorer";
import { GlassCard } from "@/components/shared/GlassCard";

export function WeeklyPnLBreakdown() {
  const { sessionPnl, tradeHistory } = useTradeStore();
  const { resolvedPhantoms } = usePhantomStore();

  const metrics = useMemo(() => {
    const resolvedTrades = tradeHistory.filter((trade) => trade.status === "won" || trade.status === "lost");
    const leftOnTable = resolvedPhantoms
      .filter((phantom) => phantom.type === "continuation" && phantom.status === "won")
      .reduce((sum, phantom) => sum + (phantom.finalPnl ?? 0), 0);
    const disciplineBonus = resolvedPhantoms
      .filter((phantom) => phantom.type === "abandoned" && phantom.status === "lost")
      .reduce((sum, phantom) => sum + Math.abs(phantom.finalPnl ?? 0), 0);
    const earlyExitCount = resolvedTrades.filter((trade) => !trade.heldToExpiry && trade.status === "won").length;
    const netPsychologyTax = calculateNetPsychologyTax(sessionPnl, leftOnTable, disciplineBonus);
    return {
      actualPnl: sessionPnl,
      leftOnTable,
      disciplineBonus,
      netPsychologyTax,
      earlyExitCount,
      resolvedCount: resolvedTrades.length,
    };
  }, [tradeHistory, resolvedPhantoms, sessionPnl]);

  const items = [
    {
      label: "Actual P&L",
      value: metrics.actualPnl,
      description: "What you made this week",
      color: metrics.actualPnl >= 0 ? "var(--color-success)" : "var(--color-danger)",
    },
    {
      label: "Left on Table",
      value: metrics.leftOnTable,
      description: "Phantom gains you missed",
      color: "var(--color-danger)",
    },
    {
      label: "Discipline Bonus",
      value: metrics.disciplineBonus,
      description: "Saved by smart avoidances",
      color: "var(--color-success)",
    },
    {
      label: "Psychology Tax",
      value: metrics.netPsychologyTax,
      description: "Net cost of behavioral patterns",
      color: Math.abs(metrics.netPsychologyTax) > 20 ? "var(--color-danger)" : "var(--color-warning)",
    },
  ];

  return (
    <GlassCard className="p-5" hoverable>
      <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide mb-4">
        Weekly P&L Breakdown
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="p-4 rounded-xl bg-white/3 border border-[var(--color-border)] text-center"
          >
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-2">
              {item.label}
            </div>
            <div className="text-xl font-black tabular-nums" style={{ color: item.color }}>
              {formatCurrency(item.value)}
            </div>
            <div className="text-[9px] text-[var(--color-text-muted)] mt-1">
              {item.description}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-xl bg-[var(--color-danger-dim)] border border-[var(--color-danger)]/20">
        <div className="text-[10px] font-bold text-[var(--color-danger)] uppercase tracking-wide mb-1">
          #1 Behavioral Leak: Fear of Giveback
        </div>
        <p className="text-[10px] text-[var(--color-text-secondary)]">
          You exited {metrics.earlyExitCount} winning trade{metrics.earlyExitCount === 1 ? "" : "s"} before expiry
          across {metrics.resolvedCount} resolved positions this session.
        </p>
      </div>
    </GlassCard>
  );
}
