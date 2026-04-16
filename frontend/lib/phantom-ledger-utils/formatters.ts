"use strict";

export function formatCurrency(value: number, currency = "USD", compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    const sign = value < 0 ? "-" : "+";
    const abs = Math.abs(value);
    if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
    return `${sign}$${(abs / 1000).toFixed(1)}k`;
  }

  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(decimals)}%`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function pnlColor(value: number): string {
  if (value > 0) return "text-[var(--color-success)]";
  if (value < 0) return "text-[var(--color-danger)]";
  return "text-[var(--color-text-secondary)]";
}

export function pnlBg(value: number): string {
  if (value > 0) return "bg-[var(--color-success-dim)]";
  if (value < 0) return "bg-[var(--color-danger-dim)]";
  return "bg-transparent";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
