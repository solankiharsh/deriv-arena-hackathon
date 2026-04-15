"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Ghost, TrendingUp, TrendingDown } from "lucide-react";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { formatCurrency } from "@/lib/utils/formatters";
import { CONFIDENCE_TIER_COLORS, CONFIDENCE_TIER_BG } from "@/lib/engines/phantom-capture";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import Link from "next/link";

export function PhantomQuickView() {
  const { activePhantoms, analytics } = usePhantomStore();
  const topPhantoms = activePhantoms.slice(0, 4);
  const prevCountRef = useRef(activePhantoms.length);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (activePhantoms.length > prevCountRef.current) {
      const newest = activePhantoms[activePhantoms.length - 1];
      if (newest) {
        const dir = newest.direction === "CALL" ? "RISE" : "FALL";
        setToast(`Phantom captured: ${dir} ${newest.assetDisplayName} — ${newest.confidenceTier}`);
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
      }
    }
    prevCountRef.current = activePhantoms.length;
  }, [activePhantoms]);

  return (
    <div className="glass rounded-2xl p-5 h-full relative">
      {/* Capture toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute -top-2 left-4 right-4 z-10 px-3 py-2 rounded-xl text-[10px] font-bold text-center border"
            style={{
              background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(139,92,246,0.05))",
              borderColor: "rgba(139,92,246,0.3)",
              color: "var(--color-phantom)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Ghost size={12} className="inline mr-1.5 -mt-0.5" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Ghost size={16} className="text-[var(--color-phantom)]" />
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            Phantom Portfolio
          </h2>
          {activePhantoms.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--color-phantom-dim)] text-[var(--color-phantom)] border border-[var(--color-phantom)]/20">
              {activePhantoms.length} LIVE
            </span>
          )}
        </div>
        <Link
          href="/phantoms"
          className="text-[10px] font-semibold text-[var(--color-phantom)] hover:text-[var(--color-phantom)]/80 transition-colors"
        >
          View all →
        </Link>
      </div>

      {topPhantoms.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <Ghost size={24} className="text-[var(--color-text-muted)] mb-2 opacity-50" />
          <p className="text-xs text-[var(--color-text-muted)]">
            No active phantoms. Browse assets, select a direction, hover the buy button — then change your mind. A phantom will be captured.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {topPhantoms.map((phantom) => {
            const pnl = phantom.currentPnl ?? 0;
            const isPositive = pnl >= 0;

            return (
              <motion.div
                key={phantom.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="relative flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-[var(--color-border)] hover:border-[var(--color-phantom)]/20 transition-all overflow-hidden group"
              >
                {/* Phantom shimmer */}
                <div className="absolute inset-0 phantom-shimmer opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Direction icon */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: CONFIDENCE_TIER_BG[phantom.confidenceTier],
                  }}
                >
                  {phantom.direction === "CALL" ? (
                    <TrendingUp size={14} style={{ color: CONFIDENCE_TIER_COLORS[phantom.confidenceTier] }} />
                  ) : (
                    <TrendingDown size={14} style={{ color: CONFIDENCE_TIER_COLORS[phantom.confidenceTier] }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                      {phantom.assetDisplayName}
                    </span>
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide"
                      style={{
                        color: CONFIDENCE_TIER_COLORS[phantom.confidenceTier],
                        background: CONFIDENCE_TIER_BG[phantom.confidenceTier],
                      }}
                    >
                      {phantom.confidenceTier}
                    </span>
                  </div>
                  <div className="text-[9px] text-[var(--color-text-muted)] capitalize mt-0.5">
                    {phantom.type} phantom
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <AnimatedNumber
                    value={pnl}
                    prefix="$"
                    showSign
                    className={`text-sm font-bold ${
                      isPositive ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                    }`}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-3 gap-3 pt-4 border-t border-[var(--color-border)]">
        <div>
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">
            Phantom P&L
          </div>
          <div
            className={`text-sm font-bold ${
              analytics.totalPhantomPnl >= 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {formatCurrency(analytics.totalPhantomPnl)}
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">
            Win Rate
          </div>
          <div className="text-sm font-bold text-[var(--color-phantom)]">
            {analytics.phantomWinRate.toFixed(0)}%
          </div>
        </div>
        <div>
          <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">
            Smart Saves
          </div>
          <div className="text-sm font-bold text-[var(--color-success)]">
            {analytics.smartAvoidanceCount}
          </div>
        </div>
      </div>
    </div>
  );
}
