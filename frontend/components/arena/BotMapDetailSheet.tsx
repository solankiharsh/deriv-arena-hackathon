'use client';

import { useEffect, useMemo } from 'react';
import type { Bot } from '@/lib/api/trading-bots';
import { useBotStore } from '@/lib/stores/bot-store';
import { BotLevelBadge } from '@/components/dashboard/BotLevelBadge';
import { BotMiniPnLChart, buildCumulativePnLSeries } from '@/components/dashboard/BotMiniPnLChart';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bot: Bot | null;
  userId: string;
}

export function BotMapDetailSheet({ open, onOpenChange, bot, userId }: Props) {
  const { trades, analytics, fetchTrades, fetchAnalytics } = useBotStore();
  const a = bot ? analytics[bot.id] : undefined;
  const t = bot ? trades[bot.id] : undefined;

  useEffect(() => {
    if (!open || !bot) return;
    const st = useBotStore.getState();
    if (!st.analytics[bot.id]) {
      fetchAnalytics(userId, bot.id).catch(() => {});
    }
    if (!st.trades[bot.id]) {
      fetchTrades(userId, bot.id, 50).catch(() => {});
    }
  }, [open, bot, userId, fetchAnalytics, fetchTrades]);

  const totalPnL = a ? Number(a.total_pnl) : 0;
  const winRate = a ? Number(a.win_rate) : 0;
  const totalTrades = a ? a.total_trades : 0;
  const pnlColor = totalPnL > 0 ? '#00ff41' : totalPnL < 0 ? '#ff0033' : 'rgba(255,255,255,0.4)';

  const sparklineSeries = useMemo(
    () => (t?.length ? buildCumulativePnLSeries(t) : []),
    [t]
  );

  if (!bot) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md border-l overflow-y-auto"
        style={{ background: '#07090F', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <SheetHeader>
          <SheetTitle className="font-mono text-left text-white">{bot.name}</SheetTitle>
          <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
            {bot.execution_mode === 'paper' ? 'Paper' : 'Deriv Demo'} · {bot.status}
          </p>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <BotLevelBadge bot={bot} />

          <div>
            <p className="text-[10px] font-mono text-white/35 uppercase mb-2">Cumulative P&amp;L</p>
            {t !== undefined && (
              <>
                {sparklineSeries.length > 0 ? (
                  <BotMiniPnLChart trades={t} />
                ) : (
                  <p className="text-[10px] font-mono text-white/25 text-center py-3 border border-white/[0.06] rounded bg-white/[0.02]">
                    {t.length === 0 ? 'No trades yet' : 'No realized P&L in history'}
                  </p>
                )}
              </>
            )}
            {t === undefined && (
              <div className="h-[64px] rounded bg-white/[0.02] animate-pulse" />
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Stat label="P&L" value={`${totalPnL >= 0 ? '+' : ''}$${totalPnL.toFixed(2)}`} color={pnlColor} />
            <Stat label="Win Rate" value={`${winRate.toFixed(1)}%`} color="rgba(255,255,255,0.9)" />
            <Stat label="Trades" value={String(totalTrades)} color="rgba(255,255,255,0.9)" />
          </div>

          <p className="text-[10px] font-mono text-white/30">
            Use the Command tab to start, pause, or delete this bot.
          </p>
        </div>
      </SheetContent>
    </Sheet>
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
