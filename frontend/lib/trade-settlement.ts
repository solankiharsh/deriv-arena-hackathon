import type { TradeStatus } from "@/lib/db/schema";

export const SIMULATED_STARTING_BALANCE = 10_000;
const WIN_PAYOUT_MULTIPLIER = 0.85;
const EARLY_EXIT_PROFIT_HAIRCUT = 0.7;

export function deriveBalance({
  baseBalance,
  cumulativePnl,
}: {
  baseBalance: number;
  cumulativePnl: number;
}): number {
  return roundMoney(baseBalance + cumulativePnl);
}

export function resolveExpirySettlement({
  hasReliableEntry,
  won,
  stake,
}: {
  hasReliableEntry: boolean;
  won: boolean;
  stake: number;
}): {
  pnl: number;
  status: TradeStatus;
  won: boolean;
} {
  if (!hasReliableEntry) {
    return { pnl: 0, status: "sold", won: false };
  }

  return {
    pnl: roundMoney(won ? stake * WIN_PAYOUT_MULTIPLIER : -stake),
    status: won ? "won" : "lost",
    won,
  };
}

export function resolveEarlySellSettlement({
  hasReliableEntry,
  currentPnl,
}: {
  hasReliableEntry: boolean;
  currentPnl: number;
}): {
  pnl: number;
  status: TradeStatus;
  won: boolean;
} {
  if (!hasReliableEntry) {
    return { pnl: 0, status: "sold", won: false };
  }

  const pnl = roundMoney(
    currentPnl > 0 ? currentPnl * EARLY_EXIT_PROFIT_HAIRCUT : currentPnl
  );
  const won = pnl >= 0;

  return {
    pnl,
    status: won ? "won" : "lost",
    won,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
