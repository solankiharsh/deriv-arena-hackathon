'use client';

import { Bot, BotAnalytics } from '@/lib/api/trading-bots';
import { BotLevelBadge } from './BotLevelBadge';

const GOLD = '#E8B45E';

interface Props {
  bot: Bot;
  analytics?: BotAnalytics;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
}

function statusMeta(status: string): { color: string; label: string; dot: boolean } {
  switch (status) {
    case 'running':
      return { color: '#00ff41', label: 'Running', dot: true };
    case 'paused':
      return { color: '#E8B45E', label: 'Paused', dot: false };
    case 'error':
      return { color: '#ff0033', label: 'Error', dot: false };
    default:
      return { color: 'rgba(255,255,255,0.4)', label: 'Stopped', dot: false };
  }
}

export function BotCard({ bot, analytics, onSelect, onStart, onStop, onPause, onResume, onDelete }: Props) {
  const meta = statusMeta(bot.status);
  const totalPnL = analytics ? Number(analytics.total_pnl) : 0;
  const winRate = analytics ? Number(analytics.win_rate) : 0;
  const totalTrades = analytics ? analytics.total_trades : 0;
  const pnlColor = totalPnL > 0 ? '#00ff41' : totalPnL < 0 ? '#ff0033' : 'rgba(255,255,255,0.4)';

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={onSelect}
      className="p-4 rounded cursor-pointer transition hover:border-[#E8B45E]/40"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-mono font-bold text-sm text-white truncate">{bot.name}</h3>
          </div>
          <div className="text-[10px] font-mono text-white/30 uppercase mt-0.5 tracking-wider">
            {bot.execution_mode === 'paper' ? 'Paper Trading' : 'Deriv Demo'}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`w-2 h-2 rounded-full ${meta.dot ? 'animate-pulse' : ''}`}
            style={{ background: meta.color }}
          />
          <span className="text-[10px] uppercase font-mono" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
      </div>

      <div className="mb-3">
        <BotLevelBadge bot={bot} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="P&L" value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`} color={pnlColor} />
        <Stat label="Win Rate" value={`${winRate.toFixed(1)}%`} color="rgba(255,255,255,0.9)" />
        <Stat label="Trades" value={String(totalTrades)} color="rgba(255,255,255,0.9)" />
      </div>

      <div className="flex gap-1.5" onClick={stopPropagation}>
        {bot.status === 'stopped' && (
          <ActionButton label="Start" primary onClick={onStart} />
        )}
        {bot.status === 'running' && (
          <>
            <ActionButton label="Pause" onClick={onPause} />
            <ActionButton label="Stop" onClick={onStop} />
          </>
        )}
        {bot.status === 'paused' && (
          <>
            <ActionButton label="Resume" primary onClick={onResume} />
            <ActionButton label="Stop" onClick={onStop} />
          </>
        )}
        {bot.status === 'error' && (
          <ActionButton label="Restart" primary onClick={onStart} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete bot "${bot.name}"? This cannot be undone.`)) onDelete();
          }}
          className="px-2 py-1.5 rounded text-[10px] font-mono uppercase transition"
          style={{
            background: 'rgba(255,0,51,0.08)',
            border: '1px solid rgba(255,0,51,0.2)',
            color: '#ff6b6b',
          }}
          title="Delete bot"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="px-2 py-1.5 rounded"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
    >
      <div className="text-[9px] font-mono text-white/40 uppercase tracking-wider">{label}</div>
      <div className="font-mono text-xs font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function ActionButton({ label, primary, onClick }: { label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-2 py-1.5 rounded text-[10px] font-mono uppercase tracking-wider font-bold transition"
      style={
        primary
          ? {
              background: `linear-gradient(135deg, ${GOLD} 0%, #D09A3A 100%)`,
              color: '#000',
            }
          : {
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
            }
      }
    >
      {label}
    </button>
  );
}
