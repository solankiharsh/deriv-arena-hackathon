'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useBotStore } from '@/lib/stores/bot-store';
import { botStreamUrl, Bot } from '@/lib/api/trading-bots';
import { BotPnLChart } from './BotPnLChart';
import { BotTradesList } from './BotTradesList';
import { BotLevelBadge } from './BotLevelBadge';
import type { LevelUpEvent } from './LevelUpNotification';

const GOLD = '#E8B45E';

interface Props {
  userId: string;
  bot: Bot | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLevelUp?: (event: LevelUpEvent) => void;
}

type Tab = 'overview' | 'trades' | 'signals' | 'config';

export function BotDetailView({ userId, bot, open, onOpenChange, onLevelUp }: Props) {
  const {
    trades,
    analytics,
    signals,
    fetchTrades,
    fetchAnalytics,
    fetchSignals,
    startBot,
    stopBot,
    pauseBot,
    resumeBot,
    applyTradeEvent,
    applyAnalyticsEvent,
    applyLevelUpEvent,
    applyStatusEvent,
  } = useBotStore();
  const [actionBusy, setActionBusy] = useState<null | 'start' | 'stop' | 'pause' | 'resume'>(null);
  const [tab, setTab] = useState<Tab>('overview');

  const botId = bot?.id;
  const botTrades = botId ? trades[botId] || [] : [];
  const botAnalytics = botId ? analytics[botId] : undefined;
  const botSignals = botId ? signals[botId] || [] : [];

  // Load data when opening
  useEffect(() => {
    if (!open || !botId || !userId) return;
    fetchTrades(userId, botId).catch(() => {});
    fetchAnalytics(userId, botId).catch(() => {});
    fetchSignals(userId, botId).catch(() => {});
  }, [open, botId, userId, fetchTrades, fetchAnalytics, fetchSignals]);

  // WS subscription for live updates
  useEffect(() => {
    if (!open || !botId || !userId) return;
    let ws: WebSocket | null = null;
    let cancelled = false;
    try {
      ws = new WebSocket(botStreamUrl(userId, botId));
      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(evt.data);
          switch (msg.type) {
            case 'trade':
              if (msg.data) applyTradeEvent(botId, msg.data);
              break;
            case 'analytics':
              if (msg.data) applyAnalyticsEvent(botId, msg.data);
              break;
            case 'level_up':
              if (msg.data) {
                applyLevelUpEvent(
                  botId,
                  msg.data.new_level,
                  msg.data.xp ?? bot?.xp ?? 0,
                  msg.data.unlocked_features || []
                );
                onLevelUp?.({
                  botId,
                  botName: bot?.name || 'Bot',
                  oldLevel: msg.data.old_level,
                  newLevel: msg.data.new_level,
                  unlockedFeatures: msg.data.unlocked_features || [],
                });
              }
              break;
            case 'status':
              if (msg.data?.status) applyStatusEvent(botId, msg.data.status);
              break;
          }
        } catch {
          /* ignore malformed */
        }
      };
    } catch {
      /* ignore */
    }
    return () => {
      cancelled = true;
      if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    };
  }, [open, botId, userId, bot?.name, bot?.xp, applyTradeEvent, applyAnalyticsEvent, applyLevelUpEvent, applyStatusEvent, onLevelUp]);

  const statusColor = useMemo(() => {
    switch (bot?.status) {
      case 'running': return '#00ff41';
      case 'paused': return GOLD;
      case 'error': return '#ff0033';
      default: return 'rgba(255,255,255,0.4)';
    }
  }, [bot?.status]);

  if (!bot) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto border-l"
        style={{ background: '#07090F', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="font-mono text-white tracking-tight text-base">{bot.name}</SheetTitle>
          <SheetDescription className="font-mono text-[11px] text-white/40 flex items-center gap-2">
            <span className="uppercase">{bot.execution_mode === 'paper' ? 'Paper' : 'Deriv Demo'}</span>
            <span>·</span>
            <span className="uppercase" style={{ color: statusColor }}>{bot.status}</span>
          </SheetDescription>
        </SheetHeader>

        <div className="mb-4">
          <BotLevelBadge bot={bot} />
        </div>

        {/* Bot controls */}
        <div className="flex flex-wrap gap-2 mb-4">
          {bot.status === 'stopped' && (
            <ControlButton
              label={actionBusy === 'start' ? 'Starting…' : 'Start Bot'}
              primary
              disabled={!!actionBusy}
              onClick={async () => {
                setActionBusy('start');
                try { await startBot(userId, bot.id); } finally { setActionBusy(null); }
              }}
            />
          )}
          {bot.status === 'running' && (
            <>
              <ControlButton
                label={actionBusy === 'pause' ? 'Pausing…' : 'Pause'}
                disabled={!!actionBusy}
                onClick={async () => {
                  setActionBusy('pause');
                  try { await pauseBot(userId, bot.id); } finally { setActionBusy(null); }
                }}
              />
              <ControlButton
                label={actionBusy === 'stop' ? 'Stopping…' : 'Stop'}
                danger
                disabled={!!actionBusy}
                onClick={async () => {
                  setActionBusy('stop');
                  try { await stopBot(userId, bot.id); } finally { setActionBusy(null); }
                }}
              />
            </>
          )}
          {bot.status === 'paused' && (
            <>
              <ControlButton
                label={actionBusy === 'resume' ? 'Resuming…' : 'Resume'}
                primary
                disabled={!!actionBusy}
                onClick={async () => {
                  setActionBusy('resume');
                  try { await resumeBot(userId, bot.id); } finally { setActionBusy(null); }
                }}
              />
              <ControlButton
                label="Stop"
                danger
                disabled={!!actionBusy}
                onClick={async () => {
                  setActionBusy('stop');
                  try { await stopBot(userId, bot.id); } finally { setActionBusy(null); }
                }}
              />
            </>
          )}
          {bot.status === 'error' && (
            <ControlButton
              label={actionBusy === 'start' ? 'Restarting…' : 'Restart'}
              primary
              disabled={!!actionBusy}
              onClick={async () => {
                setActionBusy('start');
                try { await startBot(userId, bot.id); } finally { setActionBusy(null); }
              }}
            />
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {(['overview', 'trades', 'signals', 'config'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-3 py-2 text-[11px] font-mono uppercase tracking-wider transition"
              style={{
                color: tab === t ? GOLD : 'rgba(255,255,255,0.5)',
                borderBottom: `2px solid ${tab === t ? GOLD : 'transparent'}`,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="Total P&L" value={botAnalytics ? `${Number(botAnalytics.total_pnl) >= 0 ? '+' : ''}$${Number(botAnalytics.total_pnl).toFixed(2)}` : '$0.00'} color={botAnalytics && Number(botAnalytics.total_pnl) >= 0 ? '#00ff41' : '#ff6b6b'} />
              <Metric label="Win Rate" value={botAnalytics ? `${Number(botAnalytics.win_rate).toFixed(1)}%` : '0%'} />
              <Metric label="Trades" value={String(botAnalytics?.total_trades ?? 0)} />
              <Metric label="Best Streak" value={String(bot.best_streak)} />
            </div>

            <BotPnLChart trades={botTrades} />

            <div className="grid grid-cols-2 gap-2">
              <Metric label="Winning" value={String(botAnalytics?.winning_trades ?? 0)} />
              <Metric label="Losing" value={String(botAnalytics?.losing_trades ?? 0)} />
              <Metric label="Avg Win" value={botAnalytics ? `$${Number(botAnalytics.avg_win).toFixed(2)}` : '-'} />
              <Metric label="Avg Loss" value={botAnalytics ? `$${Number(botAnalytics.avg_loss).toFixed(2)}` : '-'} />
              <Metric label="Max Drawdown" value={botAnalytics ? `$${Number(botAnalytics.max_drawdown).toFixed(2)}` : '-'} />
              <Metric label="Current Streak" value={String(bot.win_streak)} />
            </div>
          </div>
        )}

        {tab === 'trades' && <BotTradesList trades={botTrades} />}

        {tab === 'signals' && (
          <div className="space-y-2">
            {botSignals.length === 0 ? (
              <div className="p-4 rounded text-center text-xs font-mono text-white/40" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                No signals logged yet
              </div>
            ) : (
              botSignals.map((sig) => (
                <div
                  key={sig.id}
                  className="p-3 rounded"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-white uppercase">{sig.signal_type}</span>
                    <span className="text-[10px] font-mono text-white/40">
                      {(sig.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-white/50 mt-1">{sig.action_taken}</div>
                  <div className="text-[9px] font-mono text-white/30 mt-1">
                    {new Date(sig.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'config' && (
          <div className="space-y-2">
            <ConfigRow label="Risk Profile" value={bot.config.riskProfile} />
            <ConfigRow label="Markets" value={bot.config.marketSelection?.join(', ') || '-'} />
            <ConfigRow label="Contract Types" value={bot.config.contractTypes?.join(', ') || '-'} />
            <ConfigRow label="Indicators" value={bot.config.indicators?.technical?.join(', ') || '-'} />
            <ConfigRow label="AI Patterns" value={bot.config.indicators?.aiPatterns ? 'On' : 'Off'} />
            <ConfigRow label="News Weight" value={`${((bot.config.indicators?.newsWeight ?? 0) * 100).toFixed(0)}%`} />
            <ConfigRow label="Stake" value={`$${bot.config.execution?.stakeAmount ?? 0}`} />
            <ConfigRow label="Max Daily Trades" value={String(bot.config.execution?.maxDailyTrades ?? 0)} />
            <ConfigRow label="Stop Loss" value={`${bot.config.execution?.stopLossPercent ?? 0}%`} />
            <ConfigRow label="Take Profit" value={`${bot.config.execution?.takeProfitPercent ?? 0}%`} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="p-3 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="text-[9px] font-mono uppercase text-white/40 tracking-wider">{label}</div>
      <div className="font-mono text-sm font-bold tabular-nums mt-0.5" style={{ color: color || 'rgba(255,255,255,0.9)' }}>
        {value}
      </div>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  primary,
  danger,
  disabled,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const style: React.CSSProperties = primary
    ? {
        background: `linear-gradient(135deg, ${GOLD} 0%, #D09A3A 100%)`,
        color: '#000',
        boxShadow: `0 0 16px ${GOLD}40`,
        opacity: disabled ? 0.6 : 1,
      }
    : danger
    ? {
        background: 'rgba(255,0,51,0.08)',
        border: '1px solid rgba(255,0,51,0.3)',
        color: '#ff6b6b',
        opacity: disabled ? 0.6 : 1,
      }
    : {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.85)',
        opacity: disabled ? 0.6 : 1,
      };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-wider font-bold transition disabled:cursor-not-allowed"
      style={style}
    >
      {label}
    </button>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-[10px] font-mono uppercase text-white/40 tracking-wider">{label}</span>
      <span className="text-xs font-mono text-white/90 truncate max-w-[60%] text-right">{value}</span>
    </div>
  );
}
