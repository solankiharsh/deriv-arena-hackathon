'use strict';

import type { PaperLedger } from './ledger';
import type { PaperPosition } from './ledger';

/** Parsed numeric caps for client-side paper (mirrors Go `partner_rules` where applicable). */
export interface PaperRuleLimits {
  maxStakePerContract?: number;
  maxLossPerDay?: number;
  maxDrawdownPercent?: number;
}

export function partnerRulesToPaperLimits(raw: unknown): PaperRuleLimits | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: PaperRuleLimits = {};
  const num = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n : undefined;
  };
  const ms = num(o.max_stake_per_contract);
  const ml = num(o.max_loss_per_day);
  const md = num(o.max_drawdown_percent);
  if (ms != null && ms > 0) out.maxStakePerContract = ms;
  if (ml != null && ml > 0) out.maxLossPerDay = ml;
  if (md != null && md > 0) out.maxDrawdownPercent = md;
  return Object.keys(out).length ? out : undefined;
}

export function computePaperClosePnl(pos: PaperPosition, exitQuote: number): number {
  if (pos.status !== 'open' || exitQuote <= 0 || pos.entryQuote <= 0) return 0;
  if (pos.side === 'CALL') {
    return pos.stake * ((exitQuote - pos.entryQuote) / pos.entryQuote);
  }
  return pos.stake * ((pos.entryQuote - exitQuote) / pos.entryQuote);
}

/** UTC calendar-day bounds for `atMs`. */
export function utcDayRangeMs(atMs: number): { start: number; end: number } {
  const d = new Date(atMs);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return { start, end: start + 86400000 };
}

/** Sum |pnl| for losing closed legs with closedAt in the UTC day of `atMs`. */
export function sumAbsPaperLossesUtcDay(ledger: PaperLedger, atMs: number): number {
  const { start, end } = utcDayRangeMs(atMs);
  let sum = 0;
  for (const p of ledger.positions) {
    if (p.status !== 'closed' || p.pnl == null || p.pnl >= 0 || p.closedAt == null) continue;
    if (p.closedAt >= start && p.closedAt < end) {
      sum += Math.abs(p.pnl);
    }
  }
  return sum;
}

export function maxDrawdownPctAlongPath(startingBalance: number, priorPnls: number[], extraPnls: number[]): number {
  let eq = startingBalance;
  let peak = startingBalance;
  let maxDD = 0;
  const apply = (pnl: number) => {
    eq += pnl;
    if (eq > peak) peak = eq;
    if (peak > 0) {
      const dd = ((peak - eq) / peak) * 100;
      if (dd > maxDD) maxDD = dd;
    }
  };
  for (const p of priorPnls) apply(p);
  for (const p of extraPnls) apply(p);
  return maxDD;
}

export function maxDrawdownPercentAfterAdditionalPnls(ledger: PaperLedger, additionalPnls: number[]): number {
  const sb = ledger.initialCash;
  const prior = ledger.positions
    .filter((p) => p.status === 'closed' && p.pnl != null && p.closedAt != null)
    .sort((a, b) => (a.closedAt ?? 0) - (b.closedAt ?? 0))
    .map((p) => p.pnl!);
  return maxDrawdownPctAlongPath(sb, prior, additionalPnls);
}

/**
 * Returns a machine-readable reason key if the step should be blocked, else `null`.
 */
export function paperStepBlockedReason(
  limits: PaperRuleLimits | undefined,
  ledger: PaperLedger,
  closePnls: number[],
  openStake: number | null,
  atMs: number,
): string | null {
  if (!limits) return null;

  if (limits.maxStakePerContract != null && openStake != null) {
    if (openStake > limits.maxStakePerContract + 1e-9) {
      return 'max_stake_per_contract';
    }
  }

  if (limits.maxLossPerDay != null) {
    let add = 0;
    for (const pnl of closePnls) {
      if (pnl < 0) add += Math.abs(pnl);
    }
    const spent = sumAbsPaperLossesUtcDay(ledger, atMs);
    if (spent + add > limits.maxLossPerDay + 1e-9) {
      return 'max_loss_per_day';
    }
  }

  if (limits.maxDrawdownPercent != null) {
    const dd = maxDrawdownPercentAfterAdditionalPnls(ledger, closePnls);
    if (dd > limits.maxDrawdownPercent + 1e-9) {
      return 'max_drawdown_percent';
    }
  }

  return null;
}
