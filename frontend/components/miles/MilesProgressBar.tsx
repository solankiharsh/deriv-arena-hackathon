'use client';

import React, { useEffect } from 'react';
import { useMilesStore } from '@/lib/stores/miles-store';

interface MilesProgressBarProps {
  userId: string;
  className?: string;
}

export function MilesProgressBar({ userId, className = '' }: MilesProgressBarProps) {
  const { stats, loading, fetchStats } = useMilesStore();

  useEffect(() => {
    if (userId) {
      fetchStats(userId);
    }
  }, [userId, fetchStats]);

  if (loading && !stats) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-2 bg-gray-200 rounded-full"></div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const tierColors = {
    bronze: 'bg-amber-600',
    silver: 'bg-gray-400',
    gold: 'bg-yellow-500',
    platinum: 'bg-purple-500',
  };

  const currentColor = tierColors[stats.tier] || tierColors.bronze;
  
  const totalEarned = parseFloat(stats.total_earned);
  const milesToNext = parseFloat(stats.miles_to_next_tier);
  
  const tierThresholds: Record<string, number> = {
    bronze: 0,
    silver: 1000,
    gold: 5000,
    platinum: 10000,
  };

  const currentTierThreshold = tierThresholds[stats.tier] || 0;
  const nextTierThreshold = stats.next_tier ? tierThresholds[stats.next_tier] : currentTierThreshold;
  
  const progress = stats.next_tier
    ? ((totalEarned - currentTierThreshold) / (nextTierThreshold - currentTierThreshold)) * 100
    : 100;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between text-sm">
        <span className="capitalize font-medium">{stats.tier} Tier</span>
        {stats.next_tier ? (
          <span className="text-muted-foreground">
            {Math.floor(milesToNext)} miles to {stats.next_tier}
          </span>
        ) : (
          <span className="text-muted-foreground">Max Tier</span>
        )}
      </div>
      <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${currentColor} transition-all duration-500 ease-out`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{totalEarned.toLocaleString()} earned</span>
        {stats.next_tier && (
          <span>{nextTierThreshold.toLocaleString()} needed</span>
        )}
      </div>
    </div>
  );
}
