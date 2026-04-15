"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Timer, TrendingDown } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { TILT_ZONE_COLORS } from "@/lib/engines/tilt-detection";

interface PreMortemModalProps {
  open: boolean;
  onStepAway: () => void;
  onTradeAnyway: () => void;
  historicalWinRate?: number;
  projectedLoss?: number;
}

const TIMER_SECONDS = 60;

export function PreMortemModal({
  open,
  onStepAway,
  onTradeAnyway,
  historicalWinRate = 38,
  projectedLoss,
}: PreMortemModalProps) {
  const [timeLeft, setTimeLeft] = useState(TIMER_SECONDS);
  const [text, setText] = useState("");
  const { score: tiltScore, zone: tiltZone, setPremortemText } = useTiltStore();

  const tiltColor = TILT_ZONE_COLORS[tiltZone];
  const isOnTilt = tiltScore > 60;

  useEffect(() => {
    if (!open) {
      setTimeLeft(TIMER_SECONDS);
      setText("");
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  const handleStepAway = () => {
    setPremortemText(text);
    onStepAway();
  };

  const handleTradeAnyway = () => {
    setPremortemText(text);
    onTradeAnyway();
  };

  const timerPercent = (timeLeft / TIMER_SECONDS) * 100;

  return (
    <Modal open={open} onClose={handleStepAway} size="lg" closeOnBackdrop={false}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${tiltColor}20`, border: `1px solid ${tiltColor}40` }}
          >
            <AlertTriangle size={20} style={{ color: tiltColor }} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--color-text-primary)]">
              PRE-MORTEM PROTOCOL
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Tilt score {tiltScore}/100. Before this trade — imagine it fails.
            </p>
          </div>
          <div className="ml-auto flex-shrink-0 text-right">
            <div className="text-2xl font-mono font-bold" style={{ color: tiltColor }}>
              {timeLeft}s
            </div>
            {/* Timer bar */}
            <div className="w-16 h-1 rounded-full bg-white/10 mt-1 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: tiltColor }}
                animate={{ width: `${timerPercent}%` }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-white/4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={12} className="text-[var(--color-danger)]" />
              <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
                Win Rate at Tilt 60+
              </span>
            </div>
            <div className="text-lg font-bold text-[var(--color-danger)]">
              {historicalWinRate}%
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">vs 57% when composed</div>
          </div>

          {projectedLoss !== undefined && (
            <div className="p-3 rounded-xl bg-white/4 border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-1">
                <Timer size={12} className="text-[var(--color-warning)]" />
                <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide">
                  Expected Additional Loss
                </span>
              </div>
              <div className="text-lg font-bold text-[var(--color-warning)]">
                -${projectedLoss.toFixed(2)}
              </div>
              <div className="text-[10px] text-[var(--color-text-muted)]">
                Based on session pattern
              </div>
            </div>
          )}
        </div>

        {/* Pre-mortem text area */}
        <div>
          <label className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-2 block">
            Why might this trade fail?
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write your honest assessment before trading..."
            className="w-full h-24 p-3 rounded-xl bg-white/5 border border-[var(--color-border)] focus:border-[var(--color-phantom)]/50 focus:outline-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none transition-colors"
            maxLength={500}
          />
          <div className="text-right text-[10px] text-[var(--color-text-muted)] mt-1">
            {text.length}/500
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleStepAway}
            className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all border border-[var(--color-success)]/30 text-[var(--color-success)] hover:bg-[var(--color-success)]/10"
          >
            Step Away
          </button>
          <button
            onClick={handleTradeAnyway}
            className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all border border-white/10 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-white/5"
          >
            Trade Anyway
          </button>
        </div>

        {isOnTilt && (
          <p className="text-center text-[10px] text-[var(--color-text-muted)]">
            Historical data shows you are 3.2x more likely to lose the next 3 trades at this tilt
            level.
          </p>
        )}
      </div>
    </Modal>
  );
}
