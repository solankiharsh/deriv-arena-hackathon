'use client';

import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WidgetType } from '@/lib/trading-copilot/types';

const COLORS = ['#00ff41', '#38bdf8', '#f472b6', '#fbbf24', '#a78bfa'];

function MetricCard({ data }: { data: Record<string, unknown> }) {
  const label = String(data.label ?? '');
  const value = String(data.value ?? '');
  const change = data.change != null ? String(data.change) : '';
  const desc = data.description != null ? String(data.description) : '';
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 max-w-sm">
      <p className="text-xs text-text-muted uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold font-mono text-accent-primary mt-1">{value}</p>
      {change ? <p className="text-sm text-text-secondary mt-1">{change}</p> : null}
      {desc ? <p className="text-xs text-text-muted mt-2">{desc}</p> : null}
    </div>
  );
}

function DataTableWidget({ data }: { data: Record<string, unknown> }) {
  const columns = (data.columns as string[]) ?? [];
  const rows = (data.rows as Record<string, unknown>[]) ?? [];
  const title = data.title != null ? String(data.title) : '';
  return (
    <div className="rounded-xl border border-border overflow-hidden my-2">
      {title ? <div className="px-3 py-2 border-b border-border text-sm font-semibold">{title}</div> : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg-secondary">
            <tr>
              {columns.map((c) => (
                <th key={c} className="text-left px-3 py-2 text-text-muted font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row, i) => (
              <tr key={i} className="border-t border-border-subtle">
                {columns.map((c) => (
                  <td key={c} className="px-3 py-2 font-mono text-text-primary">
                    {String(row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TradingChartCard({ data }: { data: Record<string, unknown> }) {
  const symbol = String(data.symbol ?? '');
  const interval = data.interval != null ? String(data.interval) : '1m';
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 my-2">
      <p className="text-sm font-semibold text-text-primary">Live chart — {symbol}</p>
      <p className="text-xs text-text-muted mt-1">
        Interval: {interval}. Open the Arena or Deriv charts for full execution context.
      </p>
    </div>
  );
}

function SignalCard({ data }: { data: Record<string, unknown> }) {
  const dir = String(data.direction ?? '');
  const conf = String(data.confidence ?? '');
  return (
    <div className="rounded-xl border border-accent-primary/30 bg-accent-primary/5 p-4 my-2 max-w-md">
      <p className="text-xs text-text-muted">Signal</p>
      <p className="text-lg font-bold text-accent-primary mt-1">
        {dir} · {conf} confidence
      </p>
      {data.reasoning != null ? (
        <p className="text-sm text-text-secondary mt-2">{String(data.reasoning)}</p>
      ) : null}
    </div>
  );
}

function FlowDiagramLite({ data }: { data: Record<string, unknown> }) {
  const nodes = (data.nodes as { id: string; label: string }[]) ?? [];
  const edges = (data.edges as { from: string; to: string; label?: string }[]) ?? [];
  return (
    <div className="rounded-xl border border-border p-4 text-sm space-y-2 my-2">
      {data.title != null ? <p className="font-semibold">{String(data.title)}</p> : null}
      <ul className="list-disc pl-4 text-text-secondary">
        {nodes.map((n) => (
          <li key={n.id}>
            <span className="font-mono text-accent-primary">{n.id}</span>: {n.label}
          </li>
        ))}
      </ul>
      <ul className="text-xs text-text-muted space-y-1">
        {edges.map((e, i) => (
          <li key={i}>
            {e.from} → {e.to}
            {e.label ? ` (${e.label})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CopilotWidgetRenderer({
  widgetType,
  data,
}: {
  widgetType: WidgetType;
  data: Record<string, unknown>;
}) {
  const chartData = useMemo(() => {
    if (widgetType === 'bar_chart' || widgetType === 'pie_chart') {
      const arr = (data.data as { name: string; value: number }[]) ?? [];
      return arr.map((d) => ({ name: d.name, value: Number(d.value) || 0 }));
    }
    if (widgetType === 'line_chart') {
      return (data.data as Record<string, string | number>[]) ?? [];
    }
    return [];
  }, [data, widgetType]);

  if (widgetType === 'metric_card') {
    return <MetricCard data={data} />;
  }
  if (widgetType === 'data_table') {
    return <DataTableWidget data={data} />;
  }
  if (widgetType === 'trading_chart') {
    return <TradingChartCard data={data} />;
  }
  if (widgetType === 'signal_card') {
    return <SignalCard data={data} />;
  }
  if (widgetType === 'flow_diagram') {
    return <FlowDiagramLite data={data} />;
  }
  if (widgetType === 'trade_ticket' || widgetType === 'portfolio' || widgetType === 'leaderboard') {
    return (
      <pre className="text-xs bg-bg-secondary border border-border rounded-lg p-3 overflow-x-auto my-2">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  if (widgetType === 'bar_chart') {
    const title = data.title != null ? String(data.title) : '';
    return (
      <div className="h-64 w-full my-3">
        {title ? <p className="text-sm font-medium mb-2">{title}</p> : null}
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
            <YAxis tick={{ fill: '#888', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#111', border: '1px solid #333' }}
              labelStyle={{ color: '#ccc' }}
            />
            <Bar dataKey="value" fill="#00ff41" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widgetType === 'pie_chart') {
    const title = data.title != null ? String(data.title) : '';
    return (
      <div className="h-64 w-full my-3">
        {title ? <p className="text-sm font-medium mb-2">{title}</p> : null}
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widgetType === 'line_chart') {
    const keys = (data.keys as string[]) ?? [];
    const title = data.title != null ? String(data.title) : '';
    return (
      <div className="h-64 w-full my-3">
        {title ? <p className="text-sm font-medium mb-2">{title}</p> : null}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
            <YAxis tick={{ fill: '#888', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: '#111', border: '1px solid #333' }} />
            <Legend />
            {keys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={COLORS[i % COLORS.length]}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <pre className="text-xs bg-bg-secondary border border-border rounded-lg p-3 overflow-x-auto my-2">
      {JSON.stringify({ widgetType, data }, null, 2)}
    </pre>
  );
}
