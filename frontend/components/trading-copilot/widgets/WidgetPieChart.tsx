'use client';

import React from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

export type CopilotPieChartData = {
  title?: string;
  data: Array<{ name: string; value: number }>;
};

const COLORS = ['#00ff41', '#38bdf8', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee'];

export function WidgetPieChart({ data }: { data: CopilotPieChartData }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card p-4">
      {data.title ? (
        <h4 className="mb-3 text-sm font-semibold text-text-primary">{data.title}</h4>
      ) : null}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data.data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={90}
              innerRadius={45}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#111',
                borderColor: '#333',
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
