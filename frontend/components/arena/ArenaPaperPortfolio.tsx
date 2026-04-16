'use client';

const GOLD = '#E8B45E';

import { useState } from 'react';
import { BarChart2, LineChart, Trophy } from 'lucide-react';
import { ArenaLeaderboard } from './ArenaLeaderboard';
import { XPLeaderboard } from './XPLeaderboard';

const shell = 'rounded-lg border border-white/[0.08] overflow-hidden' as const;
const shellInner = 'p-4 sm:p-5' as const;
const shellStyle = {
  background: 'rgba(12,16,32,0.72)' as const,
  backdropFilter: 'blur(16px)' as const,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' as const,
};

export function ArenaPaperPortfolio() {
  const [rkTab, setRkTab] = useState<'trades' | 'xp' | 'agents'>('trades');

  return (
    <div className={`${shell}`} style={shellStyle}>
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-3">
        <BarChart2 size={14} style={{ color: GOLD }} />
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-white/85">Portfolio</span>
        <span className="text-[10px] text-white/35 font-mono hidden sm:inline">· rankings & activity</span>
      </div>

      <div className="flex flex-wrap gap-1 px-3 pt-3 border-b border-white/[0.05]">
        <TabBtn small active={rkTab === 'trades'} onClick={() => setRkTab('trades')} icon={LineChart} label="Trades" />
        <TabBtn small active={rkTab === 'xp'} onClick={() => setRkTab('xp')} icon={Trophy} label="XP" />
        <TabBtn small active={rkTab === 'agents'} onClick={() => setRkTab('agents')} icon={BarChart2} label="Agents" />
      </div>

      <div className={shellInner}>
        <div className="space-y-3">
          <div
            className="rounded-md border border-white/[0.06] min-h-[200px] max-h-[min(50vh,400px)] overflow-y-auto"
            style={{ background: 'rgba(6,8,14,0.5)' }}
          >
            {rkTab === 'trades' && (
              <div className="p-2">
                <ArenaLeaderboard />
              </div>
            )}
            {rkTab === 'xp' && (
              <div className="p-2">
                <XPLeaderboard />
              </div>
            )}
            {rkTab === 'agents' && (
              <div className="p-6 text-center space-y-3">
                <p className="text-[11px] text-white/50 font-mono uppercase tracking-wider">Agent rankings</p>
                <p className="text-[10px] text-white/35 font-mono leading-relaxed max-w-sm mx-auto">
                  Cross-agent standings will appear here when the arena rankings API is connected. Use the XP tab for
                  the experimental leaderboard widget.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  icon: Icon,
  small,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: typeof LineChart;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 font-mono uppercase tracking-wider transition-colors cursor-pointer rounded ${
        small ? 'text-[10px] px-2.5 py-1.5' : 'text-[11px] px-3 py-2'
      }`}
      style={
        active
          ? { color: GOLD, background: 'rgba(232,180,94,0.1)', border: '1px solid rgba(232,180,94,0.25)' }
          : { color: 'rgba(255,255,255,0.35)', border: '1px solid transparent' }
      }
    >
      <Icon className={small ? 'w-3 h-3' : 'w-3.5 h-3.5'} style={{ color: active ? GOLD : 'rgba(255,255,255,0.25)' }} />
      {label}
    </button>
  );
}
