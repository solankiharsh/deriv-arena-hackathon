"use strict";

import type { Phantom, Trade } from "@/lib/db/schema";

export function calculateEstimatedXp(trades: Trade[], phantoms: Phantom[]): number {
  const resolvedTrades = trades.filter((t) => t.status === "won" || t.status === "lost");
  const wins = resolvedTrades.filter((t) => t.status === "won").length;
  const disciplineWins = resolvedTrades.filter((t) => t.status === "won" && t.heldToExpiry).length;
  const resolvedPhantoms = phantoms.filter((p) => p.status !== "active");
  const correctAvoidances = resolvedPhantoms.filter(
    (p) => p.type === "abandoned" && (p.finalPnl ?? 0) < 0
  ).length;

  return (
    resolvedTrades.length * 55 +
    wins * 30 +
    disciplineWins * 15 +
    correctAvoidances * 20
  );
}
