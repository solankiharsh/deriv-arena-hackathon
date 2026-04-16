"use client";

import { cn } from "@/lib/utils/cn";

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  bgColor?: string;
  height?: string;
  className?: string;
  animated?: boolean;
  showLabel?: boolean;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = "var(--color-real)",
  bgColor = "rgba(255,255,255,0.06)",
  height = "6px",
  className,
  animated = true,
  showLabel = false,
  label,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1">
          <span>{label}</span>
          <span>{percent.toFixed(0)}%</span>
        </div>
      )}
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{ height, background: bgColor }}
      >
        <div
          className={cn("h-full rounded-full", animated && "transition-all duration-700 ease-out")}
          style={{ width: `${percent}%`, background: color }}
        />
      </div>
    </div>
  );
}
