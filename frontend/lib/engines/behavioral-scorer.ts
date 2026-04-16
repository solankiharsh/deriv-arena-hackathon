"use strict";

import type { Trade, Phantom } from "../db/schema";

export interface BESComponents {
  phantomEfficiency: number;
  exitIntelligence: number;
  tiltResistance: number;
  antiYouDifferential: number;
  overallScore: number;
}

export interface WeeklyBESData {
  trades: Trade[];
  phantoms: Phantom[];
  revengeTradeCount: number;
  postLossTradeCount: number;
  yourPnl: number;
  antiYouPnl: number;
}

export function calculateBES(data: WeeklyBESData): BESComponents {
  // Phantom Efficiency (25%): how often NOT trading was the right call
  const resolvedPhantoms = data.phantoms.filter((p) => p.status !== "active");
  const correctAvoidances = resolvedPhantoms.filter((p) => {
    const pnl = p.finalPnl ?? 0;
    return p.type === "abandoned" && pnl < 0; // Would have lost
  }).length;
  const phantomEfficiency =
    resolvedPhantoms.length > 0
      ? (correctAvoidances / resolvedPhantoms.length) * 100
      : 50;

  // Exit Intelligence (25%): how often early exits were justified
  const earlyExits = data.trades.filter((t) => !t.heldToExpiry && t.status !== "active");
  const justifiedExits = earlyExits.filter((t) => {
    // An exit is "justified" if the phantom (continuation) for it ended up losing
    return (t.pnl ?? 0) > 0; // Simplification: sold for profit = justified
  }).length;
  const exitIntelligence =
    earlyExits.length > 0 ? (justifiedExits / earlyExits.length) * 100 : 75;

  // Tilt Resistance (25%): inverse of revenge trade ratio
  const tiltResistance =
    data.postLossTradeCount > 0
      ? Math.max(0, 100 - (data.revengeTradeCount / data.postLossTradeCount) * 100)
      : 100;

  // Anti-You Differential (25%): how consistently you beat your shadow
  let antiYouDifferential: number;
  if (data.antiYouPnl === 0) {
    antiYouDifferential = 50;
  } else {
    const diff = data.yourPnl - data.antiYouPnl;
    // Scale: +$100 over shadow = 100 score, -$100 = 0 score
    antiYouDifferential = Math.max(0, Math.min(100, 50 + (diff / 100) * 50));
  }

  const overallScore =
    phantomEfficiency * 0.25 +
    exitIntelligence * 0.25 +
    tiltResistance * 0.25 +
    antiYouDifferential * 0.25;

  return {
    phantomEfficiency,
    exitIntelligence,
    tiltResistance,
    antiYouDifferential,
    overallScore,
  };
}

export function calculateNetPsychologyTax(
  actualPnl: number,
  phantomMissedPnl: number,
  disciplineBonus: number
): number {
  return phantomMissedPnl - disciplineBonus;
}

export function identifyPrimaryLeak(
  revengeTradeCount: number,
  earlyExitCount: number,
  phantomFomoCount: number
): { type: string; percentage: number } {
  const total = revengeTradeCount + earlyExitCount + phantomFomoCount;
  if (total === 0) return { type: "None", percentage: 0 };

  if (revengeTradeCount >= earlyExitCount && revengeTradeCount >= phantomFomoCount) {
    return { type: "FOMO/Early Entry", percentage: (revengeTradeCount / total) * 100 };
  }
  if (earlyExitCount >= phantomFomoCount) {
    return { type: "Fear of Giveback", percentage: (earlyExitCount / total) * 100 };
  }
  return { type: "Lack of Patience", percentage: (phantomFomoCount / total) * 100 };
}
