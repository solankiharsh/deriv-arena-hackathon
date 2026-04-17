'use client';

import { BotTrade } from '@/lib/api/trading-bots';

function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function BotTradesList({ trades }: { trades: BotTrade[] }) {
  if (trades.length === 0) {
    return (
      <div className="p-6 rounded text-center text-xs font-mono text-white/40" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        No trades yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trades.map((t) => {
        const pnl = Number(t.pnl ?? 0);
        const isWin = pnl > 0;
        const isLoss = pnl < 0;
        const pnlColor = isWin ? '#00ff41' : isLoss ? '#ff0033' : 'rgba(255,255,255,0.5)';
        return (
          <div
            key={t.id}
            className="p-3 rounded flex items-center justify-between"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-white">{t.symbol}</span>
                <span
                  className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(232,180,94,0.1)', color: '#E8B45E' }}
                >
                  {t.contract_type}
                </span>
                <span
                  className="text-[10px] font-mono uppercase"
                  style={{ color: t.side === 'BUY' ? '#00ff41' : '#ff6b6b' }}
                >
                  {t.side}
                </span>
                {t.xp_gained > 0 && (
                  <span className="text-[10px] font-mono text-blue-400">+{t.xp_gained} XP</span>
                )}
              </div>
              <div className="text-[10px] font-mono text-white/30 mt-1">
                {new Date(t.executed_at).toLocaleString()}
              </div>
            </div>
            <div className="text-right shrink-0 ml-3">
              <div className="font-mono text-sm font-bold" style={{ color: pnlColor }}>
                {formatCurrency(pnl)}
              </div>
              <div className="text-[10px] font-mono text-white/40">Stake ${Number(t.stake).toFixed(2)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
