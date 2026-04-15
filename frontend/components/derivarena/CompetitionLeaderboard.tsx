'use client';

import { useCompetitionLeaderboardStream } from '@/hooks/useCompetitionLeaderboard';
import type { LeaderboardEntry } from '@/lib/derivarena-api';
import { Activity, Loader2, WifiOff, TrendingUp, TrendingDown } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'text-amber-400 border-amber-500/40 bg-amber-500/10';
  if (rank === 2) return 'text-slate-300 border-slate-400/30 bg-slate-400/10';
  if (rank === 3) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
  return 'text-white/25 border-white/[0.08] bg-white/[0.03]';
}

function pnlColor(pnl: string | number): string {
  const n = Number(pnl);
  if (n > 0) return 'text-emerald-400';
  if (n < 0) return 'text-red-400';
  return 'text-text-muted';
}

function formatPnl(pnl: string | number): string {
  const n = Number(pnl);
  const prefix = n > 0 ? '+' : '';
  return `${prefix}$${n.toFixed(2)}`;
}

function formatSortino(ratio: string | null | undefined): string {
  if (ratio == null || ratio === '') return '—';
  const n = Number(ratio);
  if (Number.isNaN(n)) return '—';
  return n.toFixed(3);
}

function displayName(entry: LeaderboardEntry): string {
  if (entry.trader_name) return entry.trader_name;
  const tid = entry.trader_id ?? '';
  if (tid.length > 6) return `${tid.slice(0, 6)}…`;
  return tid || 'Trader';
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({ entry }: { entry: LeaderboardEntry }) {
  const pnl = Number(entry.total_pnl);
  return (
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      {/* Rank */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex w-6 h-6 items-center justify-center text-[11px] font-black font-mono border ${rankBadgeClass(entry.rank)}`}
        >
          {entry.rank}
        </span>
      </td>

      {/* Name */}
      <td className="px-4 py-3">
        <span className="text-sm font-medium text-text-primary">{displayName(entry)}</span>
      </td>

      {/* Sortino */}
      <td className="px-4 py-3 tabular-nums text-sm text-text-secondary hidden sm:table-cell">
        {formatSortino(entry.sortino_ratio)}
      </td>

      {/* P&L */}
      <td className={`px-4 py-3 tabular-nums text-sm font-semibold ${pnlColor(pnl)}`}>
        <span className="inline-flex items-center gap-1">
          {pnl > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : pnl < 0 ? (
            <TrendingDown className="w-3 h-3" />
          ) : null}
          {formatPnl(pnl)}
        </span>
      </td>

      {/* Trades */}
      <td className="px-4 py-3 tabular-nums text-xs text-text-muted hidden md:table-cell">
        {entry.profitable_trades}/{entry.total_trades}
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  competitionId: string;
}

export function CompetitionLeaderboard({ competitionId }: Props) {
  const { entries, status, error } = useCompetitionLeaderboardStream(competitionId);

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-base font-bold text-text-primary">Live leaderboard</h2>
        <span className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
          {status === 'streaming' && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              live
            </>
          )}
          {status === 'loading' && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              connecting
            </>
          )}
          {status === 'error' && (
            <>
              <WifiOff className="w-3 h-3 text-red-400" />
              <span className="text-red-400">disconnected</span>
            </>
          )}
        </span>
        <span className="ml-auto text-[10px] font-mono text-text-muted">
          Ranked by Sortino ratio
        </span>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border border-red-500/20 bg-red-500/10 text-red-300 text-xs px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && status !== 'loading' && (
        <div className="border border-white/[0.08] bg-white/[0.02] p-5 text-center">
          <Activity className="w-6 h-6 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted">
            No trades recorded yet. Leaderboard updates as participants trade.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {entries.length === 0 && status === 'loading' && (
        <div className="border border-white/[0.08] bg-white/[0.02] p-5 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </div>
      )}

      {/* Table */}
      {entries.length > 0 && (
        <div className="border border-white/[0.08] bg-white/[0.02] overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-2.5 font-semibold w-10">#</th>
                <th className="px-4 py-2.5 font-semibold">Trader</th>
                <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">
                  Sortino
                </th>
                <th className="px-4 py-2.5 font-semibold">P&amp;L</th>
                <th className="px-4 py-2.5 font-semibold hidden md:table-cell">Win/Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Row key={e.id} entry={e} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
