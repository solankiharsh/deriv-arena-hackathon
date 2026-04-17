'use client';

import React from 'react';
import Link from 'next/link';
import { Briefcase, ExternalLink } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

export type CopilotPortfolioData = {
  include_history?: boolean;
};

export function WidgetPortfolio({ data }: { data: CopilotPortfolioData }) {
  const balance = useAuthStore((s) => s.balance);
  const currency = useAuthStore((s) => s.currency);
  const isAuthorized = useAuthStore((s) => s.isAuthorized);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Briefcase className="h-4 w-4 text-text-muted" />
        <h3 className="text-sm font-semibold text-text-primary">Portfolio</h3>
        <Link
          href="/arena"
          className="ml-auto inline-flex items-center gap-1 text-xs text-accent-primary hover:underline"
        >
          Open Arena <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="px-4 py-4">
        {!isAuthorized ? (
          <p className="text-sm text-text-muted">
            Sign in to a Deriv account to view your live balance and positions.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Balance</span>
              <span className="font-mono font-semibold text-text-primary">
                {currency} {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-muted">Open positions</span>
              <span className="font-medium text-text-primary">—</span>
            </div>
            <p className="text-xs text-text-muted">
              Open the Arena for full trade history and live P&amp;L.
              {data.include_history ? ' (History requested)' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
