"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
}

export function GlassCard({ children, className, hoverable = false }: GlassCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white/[0.03] backdrop-blur-xl",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:p-[1px]",
        "before:[background:linear-gradient(135deg,rgba(139,92,246,0.35),rgba(0,212,170,0.18),transparent_55%)]",
        "before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[mask-composite:xor] before:[-webkit-mask-composite:xor]",
        hoverable && "transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_22px_rgba(139,92,246,0.2)]",
        className
      )}
    >
      {children}
    </div>
  );
}
