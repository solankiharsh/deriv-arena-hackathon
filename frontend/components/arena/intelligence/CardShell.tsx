"use client";

import React from "react";

/**
 * Shared card chrome used by every Intelligence widget.
 *
 * Visual contract:
 *  - Thin 1px border (`border-white/8`) matching the rest of the Arena.
 *  - Uppercase monospace caption row with a gold accent title and an
 *    optional right-aligned source tag (e.g. "COINGECKO").
 *  - Minimal padding so multiple cards pack densely in the Terminal view.
 */
interface CardShellProps {
  title: string;
  source?: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function CardShell({
  title,
  source,
  right,
  className = "",
  children,
}: CardShellProps) {
  return (
    <div
      className={`bg-white/[0.02] border border-white/10 rounded-md overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-[0.2em]"
          style={{ color: "#E8B45E" }}
        >
          {title}
        </span>
        <div className="flex items-center gap-2">
          {right}
          {source && (
            <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">
              {source}
            </span>
          )}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

/** Small green/red numeric delta used across every market card. */
export function Delta({ value, suffix = "%" }: { value: number | null; suffix?: string }) {
  if (value === null || Number.isNaN(value)) {
    return <span className="font-mono text-[11px] text-white/30">—</span>;
  }
  const up = value >= 0;
  return (
    <span
      className={`font-mono text-[11px] ${up ? "text-green-400" : "text-red-400"}`}
    >
      {up ? "+" : ""}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}
