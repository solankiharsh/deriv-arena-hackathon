'use strict';

import type { PaperLedger } from './ledger';

function isWin(p: { side: string; pnl?: number }): boolean {
  return p.pnl != null && p.pnl > 0;
}

/** Closed positions only, most recent first */
export function closedPositionsChronological(ledger: PaperLedger) {
  return ledger.positions
    .filter((p) => p.status === 'closed' && p.closedAt != null)
    .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
}

export function winStreakFromLedger(ledger: PaperLedger): number {
  const closed = closedPositionsChronological(ledger);
  let streak = 0;
  for (const p of closed) {
    if (isWin(p)) streak += 1;
    else break;
  }
  return streak;
}

export function recentWinRate(ledger: PaperLedger, lastN: number): number {
  const closed = closedPositionsChronological(ledger).slice(0, lastN);
  if (closed.length === 0) return 0;
  const wins = closed.filter(isWin).length;
  return wins / closed.length;
}
