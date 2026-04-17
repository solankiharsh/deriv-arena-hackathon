'use client';

import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type CopilotBarChartData = {
  title?: string;
  xLabel?: string;
  yLabel?: string;
  data: Array<{ name: string; value: number; [key: string]: string | number }>;
  keys?: string[];
};

const COLORS = ['#00ff41', '#38bdf8', '#f472b6', '#fbbf24', '#a78bfa'];

export function WidgetBarChart({ data }: { data: CopilotBarChartData }) {
  const keys = data.keys ?? ['value'];

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card p-4">
      {data.title ? (
        <h4 className="mb-3 text-sm font-semibold text-text-primary">{data.title}</h4>
      ) : null}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111',
                borderColor: '#333',
                borderRadius: 8,
                fontSize: 13,
              }}
              labelStyle={{ color: '#ccc' }}
            />
            {keys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
