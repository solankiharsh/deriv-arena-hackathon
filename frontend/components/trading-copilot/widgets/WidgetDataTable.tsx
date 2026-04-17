'use client';

import React from 'react';

export type CopilotDataTableData = {
  title?: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

export function WidgetDataTable({ data }: { data: CopilotDataTableData }) {
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
      {data.title ? (
        <div className="border-b border-border px-4 py-3">
          <h4 className="text-sm font-semibold text-text-primary">{data.title}</h4>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-bg-secondary/50">
              {data.columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2.5 text-left text-xs font-medium text-text-muted"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-border/60 last:border-b-0 hover:bg-bg-secondary/30 transition-colors"
              >
                {data.columns.map((col) => (
                  <td key={col} className="px-4 py-2.5 text-sm text-text-primary font-mono">
                    {row[col] ?? '—'}
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
