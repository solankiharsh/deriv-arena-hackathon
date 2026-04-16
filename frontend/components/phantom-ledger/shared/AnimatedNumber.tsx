"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  showSign?: boolean;
}

export function AnimatedNumber({
  value,
  duration = 600,
  decimals = 2,
  prefix = "",
  suffix = "",
  className,
  showSign = false,
}: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(value);
  const prevValue = useRef(value);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    if (from === to) return;

    const startTime = performance.now();

    function easeOutCubic(t: number): number {
      return 1 - Math.pow(1 - t, 3);
    }

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = from + (to - from) * eased;
      setDisplayed(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = to;
      }
    }

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value, duration]);

  const formatted = displayed.toFixed(decimals);
  const sign = showSign && value > 0 ? "+" : "";

  return (
    <span className={cn("tabular-nums", className)}>
      {prefix}
      {sign}
      {formatted}
      {suffix}
    </span>
  );
}
