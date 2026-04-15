"use strict";

export interface TimelineBranch {
  id: string;
  label: string;
  description: string;
  hypotheticalPnl: number;
  actualPnl: number;
  delta: number;
  sentiment: "better" | "worse" | "same";
}

interface TradeInput {
  id: string;
  asset: string;
  direction: "CALL" | "PUT";
  stake: number;
  entrySpot: number;
  exitSpot?: number;
  pnl?: number;
  status: string;
  heldToExpiry: boolean;
}

interface ActivePositionInput {
  direction: "CALL" | "PUT";
  stake: number;
  entrySpot: number;
  currentSpot: number;
  currentPnl: number;
}

const PAYOUT_RATIO = 0.85;

function binaryPnl(direction: "CALL" | "PUT", entry: number, exit: number, stake: number): number {
  if (entry === 0) return 0;
  const won = direction === "CALL" ? exit > entry : exit < entry;
  return won ? stake * PAYOUT_RATIO : -stake;
}

export function computeBranchedTimelines(
  trades: TradeInput[],
  activePosition?: ActivePositionInput | null,
): TimelineBranch[] {
  const branches: TimelineBranch[] = [];
  const resolved = trades.filter((t) => t.status === "won" || t.status === "lost");

  if (resolved.length === 0 && !activePosition) return branches;

  const actualTotalPnl = resolved.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  // "If you reversed" — flip direction on every resolved trade
  if (resolved.length > 0) {
    const reversedPnl = resolved.reduce((sum, t) => {
      if (!t.exitSpot || !t.entrySpot) return sum + (t.pnl ?? 0);
      const flipped: "CALL" | "PUT" = t.direction === "CALL" ? "PUT" : "CALL";
      return sum + binaryPnl(flipped, t.entrySpot, t.exitSpot, t.stake);
    }, 0);

    const delta = reversedPnl - actualTotalPnl;
    branches.push({
      id: "reversed",
      label: "If you reversed",
      description: `Every trade flipped: ${resolved.length} trades`,
      hypotheticalPnl: Math.round(reversedPnl * 100) / 100,
      actualPnl: Math.round(actualTotalPnl * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      sentiment: delta > 0.01 ? "better" : delta < -0.01 ? "worse" : "same",
    });
  }

  // "If you skipped worst" — remove the single worst trade
  if (resolved.length >= 2) {
    const worstTrade = resolved.reduce((worst, t) =>
      (t.pnl ?? 0) < (worst.pnl ?? 0) ? t : worst
    );
    const withoutWorst = actualTotalPnl - (worstTrade.pnl ?? 0);
    const delta = withoutWorst - actualTotalPnl;

    branches.push({
      id: "skip-worst",
      label: "If you skipped worst",
      description: `Without your -$${Math.abs(worstTrade.pnl ?? 0).toFixed(2)} trade on ${worstTrade.asset}`,
      hypotheticalPnl: Math.round(withoutWorst * 100) / 100,
      actualPnl: Math.round(actualTotalPnl * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      sentiment: delta > 0.01 ? "better" : delta < -0.01 ? "worse" : "same",
    });
  }

  // "If you doubled down on wins" — 2x stake only on winning trades
  if (resolved.length > 0) {
    const doubledPnl = resolved.reduce((sum, t) => {
      const pnl = t.pnl ?? 0;
      if (pnl > 0) {
        return sum + pnl * 2;
      }
      return sum + pnl;
    }, 0);
    const delta = doubledPnl - actualTotalPnl;

    if (Math.abs(delta) > 0.01) {
      branches.push({
        id: "doubled-wins",
        label: "If you doubled winners",
        description: "2x stake on every winning trade",
        hypotheticalPnl: Math.round(doubledPnl * 100) / 100,
        actualPnl: Math.round(actualTotalPnl * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        sentiment: delta > 0.01 ? "better" : delta < -0.01 ? "worse" : "same",
      });
    }
  }

  // "If you held" — for early exits (sold before expiry)
  const earlyExits = resolved.filter((t) => !t.heldToExpiry && t.exitSpot && t.entrySpot);
  if (earlyExits.length > 0) {
    const heldPnl = resolved.reduce((sum, t) => {
      if (!t.heldToExpiry && t.exitSpot && t.entrySpot) {
        return sum + binaryPnl(t.direction, t.entrySpot, t.exitSpot, t.stake);
      }
      return sum + (t.pnl ?? 0);
    }, 0);
    const delta = heldPnl - actualTotalPnl;

    branches.push({
      id: "held",
      label: "If you held to expiry",
      description: `${earlyExits.length} early exit${earlyExits.length > 1 ? "s" : ""} held through`,
      hypotheticalPnl: Math.round(heldPnl * 100) / 100,
      actualPnl: Math.round(actualTotalPnl * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      sentiment: delta > 0.01 ? "better" : delta < -0.01 ? "worse" : "same",
    });
  }

  // "If you sat out after losses" — skip any trade that followed a loss
  if (resolved.length >= 3) {
    let prevWasLoss = false;
    let sitOutPnl = 0;
    let skippedCount = 0;
    for (const t of resolved) {
      if (prevWasLoss) {
        skippedCount++;
        prevWasLoss = (t.pnl ?? 0) < 0;
        continue;
      }
      sitOutPnl += t.pnl ?? 0;
      prevWasLoss = (t.pnl ?? 0) < 0;
    }

    if (skippedCount > 0) {
      const delta = sitOutPnl - actualTotalPnl;
      branches.push({
        id: "sit-out-losses",
        label: "If you paused after losses",
        description: `Skipped ${skippedCount} post-loss trade${skippedCount > 1 ? "s" : ""}`,
        hypotheticalPnl: Math.round(sitOutPnl * 100) / 100,
        actualPnl: Math.round(actualTotalPnl * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        sentiment: delta > 0.01 ? "better" : delta < -0.01 ? "worse" : "same",
      });
    }
  }

  return branches;
}
