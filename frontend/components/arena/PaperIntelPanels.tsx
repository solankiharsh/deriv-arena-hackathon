'use client';

const GOLD = '#E8B45E';

import type { PaperLedgerLiveStats } from '@/hooks/usePaperLedgerLive';

function fmtPnL(n: number): string {
  const s = n >= 0 ? '+' : '';
  return `${s}${n.toFixed(2)}`;
}

export function PaperTradingRecap({ paper }: { paper: PaperLedgerLiveStats }) {
  const hasAny = paper.closedCount > 0 || paper.openCount > 0;
  if (!hasAny) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-1">Paper lab</p>
        <p className="text-xs text-white/45 leading-relaxed">
          Run steps in <span className="text-amber-200/85">Paper swarm</span> (scroll up on mobile). Closes and PnL
          will show here and in <span className="text-white/55">Activity</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: GOLD }}>
          Paper lab
        </span>
        <span className="text-[10px] font-mono text-white/35">local book</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-lg font-mono font-bold text-white/90">{paper.closedCount}</div>
          <div className="text-[9px] text-white/35 uppercase tracking-wider">Closes</div>
        </div>
        <div>
          <div className="text-lg font-mono font-bold text-white/90">{paper.openCount}</div>
          <div className="text-[9px] text-white/35 uppercase tracking-wider">Open</div>
        </div>
        <div>
          <div className="text-lg font-mono font-bold text-white/90">{paper.winRatePercent}%</div>
          <div className="text-[9px] text-white/35 uppercase tracking-wider">Win rate</div>
        </div>
        <div>
          <div
            className={`text-lg font-mono font-bold ${paper.totalPnl >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'}`}
          >
            {fmtPnL(paper.totalPnl)}
          </div>
          <div className="text-[9px] text-white/35 uppercase tracking-wider">Σ PnL</div>
        </div>
      </div>
    </div>
  );
}

export function PaperActivityFeed({ paper }: { paper: PaperLedgerLiveStats }) {
  if (paper.recentClosed.length === 0) {
    return (
      <div className="mb-4 rounded-lg border border-dashed border-white/[0.08] px-3 py-2.5">
        <p className="text-[11px] text-white/40 font-mono">No paper closes yet — run a swarm step with ticks or SIM.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-white/45">Paper closes</span>
        <span className="text-[9px] font-mono text-white/30">newest first</span>
      </div>
      <div className="max-h-[220px] overflow-y-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.05]">
        {paper.recentClosed.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[11px] font-mono">
            <div className="min-w-0">
              <span className="text-white/55">{p.symbol}</span>{' '}
              <span className="text-amber-200/80">{p.side}</span>
              <span className="text-white/25"> · bar {p.openBar}</span>
            </div>
            <span className={p.pnl != null && p.pnl >= 0 ? 'text-emerald-400/90' : 'text-red-400/90'}>
              {p.pnl != null ? fmtPnL(p.pnl) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
