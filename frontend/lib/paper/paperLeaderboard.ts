'use strict';

import type { Agent } from '@/lib/types';
import { PAPER_LAB_AGENT_ID } from '@/lib/arenaIds';
import type { PaperLedger } from './ledger';
import { closedPositionsChronological } from './tradeStats';

const nowIso = () => new Date().toISOString();

/**
 * One merged leaderboard row so Portfolio / Agent Rankings reflect Paper swarm closes
 * when the legacy `/arena/leaderboard` API returns nothing.
 */
export function paperLedgerToLeaderAgent(displayName: string | undefined, ledger: PaperLedger | null): Agent | null {
  if (!ledger) return null;
  const closed = closedPositionsChronological(ledger);
  const openCount = ledger.positions.filter((p) => p.status === 'open').length;
  if (closed.length === 0 && openCount === 0) return null;

  const wins = closed.filter((p) => (p.pnl ?? 0) > 0).length;
  const winRate = closed.length > 0 ? wins / closed.length : 0;
  const totalPnl = closed.reduce((s, p) => s + (p.pnl ?? 0), 0);

  const label = (displayName || 'You').trim() || 'You';

  return {
    agentId: PAPER_LAB_AGENT_ID,
    agentName: `${label} · Paper`,
    walletAddress: '',
    sortino_ratio: 0,
    win_rate: winRate,
    total_pnl: totalPnl,
    trade_count: closed.length,
    total_volume: closed.reduce((s, p) => s + (p.stake || 0), 0),
    average_win: 0,
    average_loss: 0,
    max_win: 0,
    max_loss: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    avatarUrl: undefined,
    twitterHandle: undefined,
  };
}
