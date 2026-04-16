'use client';

const GOLD = '#E8B45E';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SwarmResult } from '@/lib/agents';

export type RunHistoryPoint = {
  bar: number;
  equity: number;
  action: string;
  score: number;
  conf: number;
};

export function PaperAgentRunChart({
  history,
  lastSwarm,
  chartHeight = 200,
}: {
  history: RunHistoryPoint[];
  lastSwarm: SwarmResult | null;
  /** Pixel height for each chart panel (Recharts ResponsiveContainer). */
  chartHeight?: number;
}) {
  const equityData = useMemo(
    () => history.map((h) => ({ name: String(h.bar), equity: h.equity, action: h.action })),
    [history],
  );

  const analyzerBars = useMemo(() => {
    if (!lastSwarm) return [];
    return lastSwarm.analyzers.map((a) => ({ name: a.id, v: a.score }));
  }, [lastSwarm]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
      <div className="border border-white/[0.08] rounded-lg p-3" style={{ background: '#0a0c12' }}>
        <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: GOLD }}>
          Paper equity (per step)
        </div>
        {equityData.length < 2 ? (
          <p className="text-[11px] text-white/35 font-mono py-8 text-center">Run steps to chart equity</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <LineChart data={equityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
                formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : '—', 'equity']}
              />
              <Line type="monotone" dataKey="equity" stroke={GOLD} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border border-white/[0.08] rounded-lg p-3" style={{ background: '#0a0c12' }}>
        <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: GOLD }}>
          Last swarm scores
        </div>
        {!lastSwarm ? (
          <p className="text-[11px] text-white/35 font-mono py-8 text-center">No run yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart data={analyzerBars} layout="vertical" margin={{ left: 72, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[-1, 1]} tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fill: 'rgba(255,255,255,0.45)', fontSize: 9 }} />
              <Tooltip
                contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }}
                formatter={(v) => [typeof v === 'number' ? v.toFixed(2) : '—', 'score']}
              />
              <Bar dataKey="v" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                {analyzerBars.map((e, i) => (
                  <Cell key={i} fill={e.v >= 0 ? 'rgba(74,222,128,0.75)' : 'rgba(248,113,113,0.75)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
        {lastSwarm && (
          <p className="text-[10px] text-white/40 font-mono mt-2">
            Fused {lastSwarm.fused.score.toFixed(3)} · conf {lastSwarm.fused.confidence.toFixed(2)} → {lastSwarm.fused.action}
          </p>
        )}
      </div>
    </div>
  );
}
