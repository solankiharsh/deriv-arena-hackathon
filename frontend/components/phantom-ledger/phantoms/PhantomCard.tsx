"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock, Target } from "lucide-react";
import type { Phantom } from "@/lib/db/schema";
import {
  CONFIDENCE_TIER_COLORS,
  CONFIDENCE_TIER_BG,
} from "@/lib/engines/phantom-capture";
import { ProgressBar } from "@/components/shared/ProgressBar";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { formatRelativeTime } from "@/lib/utils/formatters";

interface PhantomCardProps {
  phantom: Phantom;
  resolved?: boolean;
}

const TIER_LABELS: Record<string, string> = {
  GLANCED: "Glanced",
  WEIGHED: "Weighed",
  HOVERED: "Hovered",
  BAILED: "Bailed",
};

export function PhantomCard({ phantom, resolved = false }: PhantomCardProps) {
  const pnl = resolved ? phantom.finalPnl ?? 0 : phantom.currentPnl ?? 0;
  const isPositive = pnl >= 0;
  const tierColor = CONFIDENCE_TIER_COLORS[phantom.confidenceTier];
  const tierBg = CONFIDENCE_TIER_BG[phantom.confidenceTier];

  // Calculate time progress
  const elapsed = Date.now() - phantom.capturedAt;
  const estimated = phantom.estimatedExpiry
    ? phantom.estimatedExpiry - phantom.capturedAt
    : 5 * 60 * 1000;
  const progress = Math.min(100, (elapsed / estimated) * 100);

  return (
    <div
      className="relative group rounded-2xl border border-[var(--color-border)] overflow-hidden cursor-pointer card-hover"
      style={{ background: "var(--color-bg-secondary)" }}
    >
      {/* Spotlight effect on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"
        style={{
          background: `radial-gradient(400px at 50% 50%, ${tierColor}08, transparent 70%)`,
        }}
      />

      {/* Phantom shimmer overlay */}
      <div className="absolute inset-0 phantom-shimmer opacity-30 pointer-events-none" />

      {/* Status indicator */}
      {!resolved && (
        <div
          className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full"
          style={{
            background: tierColor,
            boxShadow: `0 0 6px ${tierColor}`,
            animation: "health-pulse 2s ease-in-out infinite",
          }}
        />
      )}

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: tierBg }}
          >
            {phantom.direction === "CALL" ? (
              <TrendingUp size={14} style={{ color: tierColor }} />
            ) : (
              <TrendingDown size={14} style={{ color: tierColor }} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                {phantom.assetDisplayName}
              </span>
              <span
                className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0"
                style={{ color: tierColor, background: tierBg }}
              >
                {phantom.confidenceTier}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] text-[var(--color-text-muted)] capitalize">
                {phantom.type}
              </span>
              <span className="text-[9px] text-[var(--color-text-muted)]">·</span>
              <span className="text-[9px] text-[var(--color-text-muted)]">
                {TIER_LABELS[phantom.confidenceTier]}
              </span>
            </div>
          </div>

          {/* P&L */}
          <div className="text-right flex-shrink-0">
            <AnimatedNumber
              value={pnl}
              prefix="$"
              showSign
              className={`text-base font-bold ${
                isPositive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
              }`}
            />
            {resolved && (
              <div
                className={`text-[9px] font-semibold ${
                  phantom.status === "won"
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-danger)]"
                }`}
              >
                {phantom.status?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Spots */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="p-2 rounded-lg bg-white/4">
            <div className="text-[8px] text-[var(--color-text-muted)] uppercase tracking-wide">
              Entry Spot
            </div>
            <div className="text-xs font-mono font-semibold text-[var(--color-text-primary)] mt-0.5">
              {phantom.entrySpot.toFixed(5)}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-white/4">
            <div className="text-[8px] text-[var(--color-text-muted)] uppercase tracking-wide">
              Current Spot
            </div>
            <div className="text-xs font-mono font-semibold text-[var(--color-text-primary)] mt-0.5">
              {(phantom.currentSpot ?? phantom.entrySpot).toFixed(5)}
            </div>
          </div>
        </div>

        {/* Progress bar (time elapsed) */}
        {!resolved && (
          <ProgressBar
            value={progress}
            color={tierColor}
            height="3px"
            className="mb-2"
          />
        )}

        {/* Footer */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center gap-1 text-[9px] text-[var(--color-text-muted)]">
            <Clock size={9} />
            <span>{formatRelativeTime(phantom.capturedAt)}</span>
          </div>
          <div className="flex-1 text-right">
            <span
              className="text-[9px] font-medium"
              style={{ color: tierColor }}
            >
              Confidence: {phantom.confidenceScore}
            </span>
          </div>
        </div>

        {/* Capture context tooltip */}
        <div
          className="mt-2 text-[9px] text-[var(--color-text-muted)] bg-white/3 rounded-lg px-2 py-1 truncate"
          title={phantom.captureContext}
        >
          <Target size={8} className="inline mr-1" />
          {phantom.captureContext}
        </div>
      </div>
    </div>
  );
}
