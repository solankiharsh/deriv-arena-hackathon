'use client';

const GOLD = '#E8B45E';

import { Activity } from 'lucide-react';
import { PaperSwarmRunner } from '@/components/dashboard/PaperSwarmRunner';

const shellStyle = {
  background: 'rgba(12,16,32,0.75)' as const,
  backdropFilter: 'blur(18px)' as const,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 40px rgba(0,0,0,0.35)' as const,
};

/**
 * Center column for Arena / dashboard: paper swarm with relaxed spacing (not squeezed in the sidebar).
 */
export function ArenaPaperSwarmColumn() {
  return (
    <div
      className="rounded-xl border border-white/[0.1] overflow-hidden min-w-0 flex flex-col max-h-[min(72vh,760px)] xl:max-h-[min(78vh,840px)]"
      style={shellStyle}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] px-4 py-3 shrink-0">
        <Activity className="w-4 h-4" style={{ color: GOLD }} />
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/90">Paper swarm</span>
        <span className="text-[10px] text-white/35 font-mono hidden sm:inline">
          · live ticks or simulator, then run step
        </span>
      </div>
      <div className="p-4 sm:p-5 overflow-y-auto min-h-0 flex-1">
        <p className="text-[10px] font-mono text-white/40 leading-relaxed mb-4">
          Tune persona under <span className="text-amber-200/85">Agent Configuration → Trading persona</span>, then{' '}
          <span className="text-white/55">Deploy Agent</span>. Partner host caps apply when an active competition loads.
        </p>
        <PaperSwarmRunner variant="embedded-wide" />
      </div>
    </div>
  );
}
