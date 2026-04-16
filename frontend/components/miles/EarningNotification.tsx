'use client';

import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { MilesIcon } from './MilesIcon';

export interface EarningNotificationData {
  amount: number;
  source: string;
  description?: string;
}

export function showMilesEarnedNotification(data: EarningNotificationData) {
  toast.custom(
    (t) => (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[300px]">
        <div className="flex-shrink-0">
          <MilesIcon className="text-yellow-500" size={24} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm mb-1">Miles Earned!</div>
          <div className="text-sm text-muted-foreground">
            +{data.amount} miles from {data.source}
          </div>
          {data.description && (
            <div className="text-xs text-muted-foreground mt-1">
              {data.description}
            </div>
          )}
        </div>
      </div>
    ),
    {
      duration: 4000,
      position: 'bottom-right',
    }
  );
}

export function showRedemptionNotification(itemName: string, milesCost: number) {
  toast.custom(
    (t) => (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 flex items-start gap-3 min-w-[300px]">
        <div className="flex-shrink-0">
          <MilesIcon className="text-green-500" size={24} />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm mb-1">Redemption Successful!</div>
          <div className="text-sm text-muted-foreground">
            Redeemed: {itemName}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            -{milesCost} miles
          </div>
        </div>
      </div>
    ),
    {
      duration: 5000,
      position: 'bottom-right',
    }
  );
}

export function EarningNotification() {
  return null;
}
