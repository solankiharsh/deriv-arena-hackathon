'use client';

import React from 'react';
import Link from 'next/link';
import { ExternalLink, Trophy } from 'lucide-react';

export type CopilotLeaderboardData = {
  sort_by?: 'xp' | 'win_rate' | 'pnl' | 'streak';
  limit?: number;
};

type Row = {
  rank: number;
  name: string;
  xp: number;
  winRate: number;
  pnl: number;
  streak: number;
};

const SAMPLE_ROWS: Row[] = [
  { rank: 1, name: 'TraderX', xp: 12500, winRate: 72, pnl: 2340, streak: 8 },
  { rank: 2, name: 'CryptoKing', xp: 10200, winRate: 68, pnl: 1890, streak: 5 },
  { rank: 3, name: 'V75Master', xp: 8900, winRate: 65, pnl: 1450, streak: 3 },
  { rank: 4, name: 'BoomHunter', xp: 7600, winRate: 61, pnl: 980, streak: 2 },
  { rank: 5, name: 'DigitPro', xp: 6100, winRate: 58, pnl: 620, streak: 1 },
];

export function WidgetLeaderboard({ data }: { data: CopilotLeaderboardData }) {
  const sortBy = data.sort_by ?? 'xp';
  const rows = SAMPLE_ROWS.slice(0, data.limit ?? 5);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Trophy className="h-4 w-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-text-primary">Leaderboard (sample)</h3>
        <span className="ml-auto text-xs text-text-muted">Sorted by {sortBy.replace('_', ' ')}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-text-muted">
              <th className="px-4 py-2 text-left font-medium">#</th>
              <th className="px-4 py-2 text-left font-medium">Trader</th>
              <th className="px-4 py-2 text-right font-medium">XP</th>
              <th className="px-4 py-2 text-right font-medium">Win Rate</th>
              <th className="px-4 py-2 text-right font-medium">P&amp;L</th>
              <th className="px-4 py-2 text-right font-medium">Streak</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rank} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2 font-medium text-text-primary">
                  {r.rank <= 3 ? (
                    <span>{r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : '🥉'}</span>
                  ) : (
                    r.rank
                  )}
                </td>
                <td className="px-4 py-2 font-medium text-text-primary">{r.name}</td>
                <td className="px-4 py-2 text-right font-mono text-text-primary">
                  {r.xp.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right font-mono text-text-primary">{r.winRate}%</td>
                <td className="px-4 py-2 text-right font-mono text-accent-primary">
                  +${r.pnl.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right font-mono text-text-primary">{r.streak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <p className="text-[10px] text-text-muted">
          Sample data. Open the leaderboard for live rankings.
        </p>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-1 text-xs text-accent-primary hover:underline"
        >
          View live <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
