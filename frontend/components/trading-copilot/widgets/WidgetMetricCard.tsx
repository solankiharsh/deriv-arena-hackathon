'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';

export type CopilotMetricCardData = {
  label: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  description?: string;
};

const STYLES = {
  positive: 'text-accent-primary',
  negative: 'text-error',
  neutral: 'text-text-muted',
};

const ICONS = {
  positive: ArrowUp,
  negative: ArrowDown,
  neutral: Minus,
};

export function WidgetMetricCard({ data }: { data: CopilotMetricCardData }) {
  const changeType = data.changeType ?? 'neutral';
  const Icon = ICONS[changeType];

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card p-5">
      <p className="text-sm text-text-muted">{data.label}</p>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-3xl font-semibold tracking-tight text-text-primary font-mono">
          {data.value}
        </span>
        {data.change ? (
          <span className={`flex items-center gap-0.5 text-sm font-medium ${STYLES[changeType]}`}>
            <Icon className="h-3.5 w-3.5" />
            {data.change}
          </span>
        ) : null}
      </div>
      {data.description ? (
        <p className="mt-2 text-sm text-text-muted">{data.description}</p>
      ) : null}
    </div>
  );
}
