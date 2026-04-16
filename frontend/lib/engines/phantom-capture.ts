"use client";

import type { ConfidenceTier } from "../db/schema";

export interface CaptureSignal {
  assetViewedMs: number;
  stakeEntered: boolean;
  directionSelected: boolean;
  buttonHoverMs: number;
  buttonProximityPx: number;
  timeOnFormMs: number;
  cancelled: boolean;
}

export interface ConfidenceResult {
  score: number;
  tier: ConfidenceTier;
  description: string;
  signals: string[];
}

export function calculateConfidence(signals: CaptureSignal): ConfidenceResult {
  let score = 0;
  const appliedSignals: string[] = [];

  if (signals.assetViewedMs > 5000) {
    score += 10;
    appliedSignals.push("Asset viewed 5+ seconds");
  }

  if (signals.stakeEntered) {
    score += 20;
    appliedSignals.push("Stake entered");
  }

  if (signals.directionSelected) {
    score += 20;
    appliedSignals.push("Direction selected");
  }

  if (signals.buttonHoverMs > 2500) {
    score += 15;
    appliedSignals.push("Buy button hovered 2.5+ seconds");
  }

  if (signals.buttonProximityPx < 30 && signals.buttonProximityPx >= 0) {
    score += 10;
    appliedSignals.push("Mouse within 30px of buy button");
  }

  if (signals.timeOnFormMs > 10000) {
    score += 10;
    appliedSignals.push("10+ seconds on trade form");
  }

  if (signals.cancelled && score >= 55) {
    score += 15;
    appliedSignals.push("Bailed at the last second");
  }

  score = Math.min(100, score);

  return {
    score,
    tier: scoreToTier(score),
    description: buildDescription(score, signals.cancelled),
    signals: appliedSignals,
  };
}

function scoreToTier(score: number): ConfidenceTier {
  if (score <= 25) return "GLANCED";
  if (score <= 50) return "WEIGHED";
  if (score <= 75) return "HOVERED";
  return "BAILED";
}

function buildDescription(score: number, cancelled: boolean): string {
  if (score <= 25) return "Barely glanced at the trade";
  if (score <= 50) return "Seriously weighed the options";
  if (score <= 75) return cancelled ? "Finger was on the trigger — pulled back" : "Hovered over the trade, almost committed";
  return "Was going to trade, bailed at the last second";
}

export const CONFIDENCE_TIER_COLORS: Record<ConfidenceTier, string> = {
  GLANCED: "var(--color-text-muted)",
  WEIGHED: "#60a5fa",
  HOVERED: "var(--color-phantom)",
  BAILED: "var(--color-danger)",
};

export const CONFIDENCE_TIER_BG: Record<ConfidenceTier, string> = {
  GLANCED: "rgba(100, 116, 139, 0.2)",
  WEIGHED: "rgba(96, 165, 250, 0.15)",
  HOVERED: "var(--color-phantom-dim)",
  BAILED: "var(--color-danger-dim)",
};

export const CONFIDENCE_TIER_LABELS: Record<ConfidenceTier, string> = {
  GLANCED: "Glanced",
  WEIGHED: "Weighed",
  HOVERED: "Hovered",
  BAILED: "Bailed",
};
