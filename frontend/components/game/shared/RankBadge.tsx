'use client';

import { useMemo } from 'react';
import { xpToRank, formatRank } from '@/lib/engines/achievement';
import { calculateEstimatedXp } from '@/lib/utils/progression';
import { useTradeStore } from '@/lib/stores/trade-store';
import { usePhantomStore } from '@/lib/stores/phantom-store';

interface RankBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showXp?: boolean;
}

export function RankBadge({ size = 'sm', showXp = false }: RankBadgeProps) {
  const tradeHistory = useTradeStore((s) => s.tradeHistory);
  const { activePhantoms, resolvedPhantoms } = usePhantomStore();

  const rankInfo = useMemo(
    () => xpToRank(calculateEstimatedXp(tradeHistory, [...activePhantoms, ...resolvedPhantoms])),
    [tradeHistory, activePhantoms, resolvedPhantoms]
  );

  const xp = useMemo(
    () => calculateEstimatedXp(tradeHistory, [...activePhantoms, ...resolvedPhantoms]),
    [tradeHistory, activePhantoms, resolvedPhantoms]
  );

  const sizeClasses = {
    sm: 'text-[8px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-1',
    lg: 'text-xs px-3 py-1.5',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`font-black uppercase tracking-wider rounded ${sizeClasses[size]}`}
        style={{
          color: rankInfo.color,
          background: `${rankInfo.color}15`,
          border: `1px solid ${rankInfo.color}30`,
          textShadow: `0 0 8px ${rankInfo.color}40`,
        }}
      >
        {formatRank(rankInfo)}
      </span>
      {showXp && (
        <span className="text-[8px] text-text-muted font-mono tabular-nums">
          {xp.toLocaleString()} XP
        </span>
      )}
    </div>
  );
}
