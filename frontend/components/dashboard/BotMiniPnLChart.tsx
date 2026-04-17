'use client';

import { useId, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import type { BotTrade } from '@/lib/api/trading-bots';

function parsePnl(s: string | null | undefined): number | null {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Event time for chart ordering: engine often omits closed_at on instant/paper fills. */
function tradeEventTimeIso(t: BotTrade): string | null {
  const raw = t.closed_at || t.executed_at;
  if (!raw) return null;
  const ms = new Date(raw).getTime();
  return Number.isFinite(ms) ? raw : null;
}

/**
 * Cumulative realized P&L over time. Includes any trade with numeric `pnl`
 * (paper engine sets pnl + executed_at but may omit closed_at).
 */
export function buildCumulativePnLSeries(trades: BotTrade[]): { t: string; cumulativePnl: number }[] {
  const points = trades
    .map((t) => {
      const pnl = parsePnl(t.pnl);
      const tIso = tradeEventTimeIso(t);
      if (pnl === null || tIso === null) return null;
      return { tIso, sort: new Date(tIso).getTime(), pnl };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && Number.isFinite(x.sort))
    .sort((a, b) => a.sort - b.sort);

  let cum = 0;
  return points.map((x) => {
    cum += x.pnl;
    return { t: x.tIso, cumulativePnl: cum };
  });
}

/** Compact cumulative realized PnL (Recharts). */
export function BotMiniPnLChart({ trades }: { trades: BotTrade[] }) {
  const gradId = useId().replace(/:/g, '');
  const series = useMemo(() => buildCumulativePnLSeries(trades), [trades]);

  if (series.length === 0) return null;

  const last = series[series.length - 1].cumulativePnl;
  const stroke = last > 0 ? '#00ff41' : last < 0 ? '#ff0033' : '#E8B45E';

  return (
    <div className="w-full h-[64px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="t" hide />
          <YAxis domain={['auto', 'auto']} hide />
          <Area
            type="monotone"
            dataKey="cumulativePnl"
            stroke={stroke}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
