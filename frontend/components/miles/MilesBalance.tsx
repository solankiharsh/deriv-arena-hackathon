'use client';

import React, { useEffect } from 'react';
import { useMilesStore } from '@/lib/stores/miles-store';
import { MilesIcon } from './MilesIcon';

interface MilesBalanceProps {
  userId: string;
  showTier?: boolean;
  className?: string;
}

export function MilesBalance({ userId, showTier = false, className = '' }: MilesBalanceProps) {
  const { balance, loading, fetchBalance } = useMilesStore();

  useEffect(() => {
    if (userId) {
      fetchBalance(userId);
    }
  }, [userId, fetchBalance]);

  if (loading && !balance) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <MilesIcon className="text-yellow-500 animate-pulse" size={20} />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (!balance) {
    return null;
  }

  const tierColors = {
    bronze: 'text-amber-600',
    silver: 'text-gray-400',
    gold: 'text-yellow-500',
    platinum: 'text-purple-500',
  };

  const tierColor = tierColors[balance.tier] || tierColors.bronze;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <MilesIcon className={tierColor} size={20} />
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-sm">
            {parseFloat(balance.current_balance).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">miles</span>
        </div>
        {showTier && (
          <span className={`text-xs font-medium capitalize ${tierColor}`}>
            {balance.tier}
          </span>
        )}
      </div>
    </div>
  );
}
