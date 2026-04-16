'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { BotTrade } from '@/lib/api/trading-bots';

const GOLD = '#E8B45E';

export function BotPnLChart({ trades }: { trades: BotTrade[] }) {
  const chartData = useMemo(() => {
    let cum = 0;
    // Sort ascending by executed_at for cumulative line
    const sorted = [...trades].sort(
      (a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime()
    );
    return sorted.map((t, i) => {
      cum += Number(t.pnl ?? 0);
      return {
        idx: i + 1,
        time: new Date(t.executed_at).getTime(),
        pnl: Number(cum.toFixed(2)),
        trade: Number(t.pnl ?? 0),
      };
    });
  }, [trades]);

  if (chartData.length === 0) {
    return (
      <div className="p-6 rounded text-center text-xs font-mono text-white/40" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        No trades yet — start the bot to see live performance
      </div>
    );
  }

  return (
    <div
      className="p-4 rounded"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-mono uppercase tracking-wider text-white/50">Cumulative P&amp;L</h3>
        <div className="text-xs font-mono font-bold" style={{ color: GOLD }}>
          {chartData[chartData.length - 1].pnl >= 0 ? '+' : ''}
          ${chartData[chartData.length - 1].pnl.toFixed(2)}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="idx"
            stroke="rgba(255,255,255,0.3)"
            tick={{ fontSize: 10, fontFamily: 'monospace' }}
          />
          <YAxis
            stroke="rgba(255,255,255,0.3)"
            tick={{ fontSize: 10, fontFamily: 'monospace' }}
          />
          <Tooltip
            contentStyle={{
              background: '#0A0D14',
              border: '1px solid rgba(255,255,255,0.1)',
              fontSize: 11,
              fontFamily: 'monospace',
            }}
            labelFormatter={(v) => `Trade #${v}`}
            formatter={(value: any, name) => [`$${Number(value).toFixed(2)}`, String(name ?? '')]}
          />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
          <Line type="monotone" dataKey="pnl" stroke={GOLD} strokeWidth={2} dot={false} name="P&L" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
