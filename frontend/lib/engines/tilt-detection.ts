"use client";

import type { TiltZone } from "../db/schema";

export interface TiltSignal {
  type: string;
  delta: number;
  description: string;
}

export interface TiltCalculation {
  score: number;
  zone: TiltZone;
  signals: TiltSignal[];
}

/**
 * Placement-time context — evaluated when a trader enters a position.
 * Reflects the QUALITY OF THE DECISION to enter.
 */
export interface PlacementTiltInputs {
  currentScore: number;
  consecutiveLosses: number;
  timeSinceLastTradeMs: number | null;   // null = first trade of session
  timeSinceLastLossMs: number | null;    // null = no prior loss this session
  stakeEscalationRatio: number;          // currentStake / lastCompletedStake
  lastTradeWasLoss: boolean;
  isUnfamiliarAsset: boolean;            // no completed trade on this asset before
  sessionPnl: number;
  viewingPhantomPortfolio: boolean;
  viewingTimeline: boolean;
}

/**
 * Resolution-time context — evaluated when a position closes.
 * Reflects the QUALITY OF THE EXIT DECISION and outcome pattern.
 */
export interface ResolutionTiltInputs {
  currentScore: number;
  won: boolean;
  heldToExpiry: boolean;                 // false = early sell
  consecutiveLosses: number;             // already updated by caller
  previousConsecutiveLosses?: number;    // optional previous streak length
  winStreak: number;                     // already updated by caller
  sessionPnl: number;                    // after this trade
}

function push(
  signals: TiltSignal[],
  type: string,
  delta: number,
  description: string
): number {
  signals.push({ type, delta, description });
  return delta;
}

/**
 * Evaluate tilt signals at the moment of TRADE ENTRY.
 * Penalises impulsive, fearful, or reckless entry behaviour.
 * Rewards deliberate, patient, disciplined entries.
 */
export function calculateEntryTilt(inputs: PlacementTiltInputs): TiltCalculation {
  const signals: TiltSignal[] = [];
  let delta = 0;

  // ── ADDITIVE SIGNALS ──────────────────────────────────────────────────────

  // Consecutive losses compound pressure (10 pts each, cap 50)
  const lossPts = Math.min(inputs.consecutiveLosses * 10, 50);
  if (lossPts > 0) {
    delta += push(
      signals,
      "consecutive_losses",
      lossPts,
      `${inputs.consecutiveLosses} consecutive loss${inputs.consecutiveLosses > 1 ? "es" : ""}`
    );
  }

  // Re-entry speed — how quickly you jumped back in
  if (inputs.timeSinceLastTradeMs !== null) {
    if (inputs.timeSinceLastTradeMs < 30_000) {
      delta += push(signals, "panic_reentry", 22, "Panic re-entry — < 30 s since last trade");
    } else if (inputs.timeSinceLastTradeMs < 2 * 60_000) {
      delta += push(signals, "hasty_reentry", 12, "Hasty re-entry — < 2 min since last trade");
    }
  }

  // Stake sizing after last trade
  if (inputs.stakeEscalationRatio > 2.0) {
    delta += push(
      signals, "aggressive_escalation", 22,
      `Aggressive stake escalation — ${inputs.stakeEscalationRatio.toFixed(1)}× last stake`
    );
  } else if (inputs.stakeEscalationRatio > 1.5) {
    delta += push(
      signals, "stake_escalation", 14,
      `Stake escalation — ${inputs.stakeEscalationRatio.toFixed(1)}× last stake`
    );
  } else if (inputs.stakeEscalationRatio > 1.2) {
    delta += push(
      signals, "moderate_escalation", 7,
      `Moderate stake increase — ${inputs.stakeEscalationRatio.toFixed(1)}× last stake`
    );
  }

  // Recency bias — trading in the emotional window after a loss
  if (inputs.timeSinceLastLossMs !== null) {
    if (inputs.timeSinceLastLossMs < 90_000) {
      delta += push(signals, "recency_bias", 12, "Revenge trade window — loss < 90 s ago");
    } else if (inputs.timeSinceLastLossMs < 3 * 60_000) {
      delta += push(signals, "recent_loss", 6, "Still in loss window — loss < 3 min ago");
    }
  }

  // Unfamiliar asset — venturing outside your edge
  if (inputs.isUnfamiliarAsset) {
    delta += push(signals, "unfamiliar_asset", 10, "Trading on an unfamiliar asset");
  }

  // Trading while already elevated — compounds tilt
  if (inputs.currentScore > 60) {
    delta += push(signals, "trading_while_tilted", 8, "Entering a trade while already on tilt");
  } else if (inputs.currentScore > 40) {
    delta += push(signals, "trading_while_warming", 4, "Entering a trade while tilt is warming");
  }

  // Session drawdown pressure
  if (inputs.sessionPnl < -100) {
    delta += push(signals, "session_deep_red", 10, "Session P&L deep in the red (< -$100)");
  } else if (inputs.sessionPnl < -50) {
    delta += push(signals, "session_red", 5, "Session P&L in the red (< -$50)");
  }

  // ── SUBTRACTIVE SIGNALS ───────────────────────────────────────────────────

  // Break length — cooldown rewards
  if (inputs.timeSinceLastTradeMs !== null) {
    if (inputs.timeSinceLastTradeMs > 20 * 60_000) {
      delta += push(signals, "extended_break", -25, "Extended break — 20+ min cooldown");
    } else if (inputs.timeSinceLastTradeMs > 10 * 60_000) {
      delta += push(signals, "long_break", -18, "Long break — 10+ min cooldown");
    } else if (inputs.timeSinceLastTradeMs > 5 * 60_000) {
      delta += push(signals, "medium_break", -12, "Took a 5+ min break");
    }
  }

  // Responsible stake sizing after a loss
  if (inputs.lastTradeWasLoss) {
    if (inputs.stakeEscalationRatio < 0.75) {
      delta += push(signals, "responsible_sizing_after_loss", -12, "Reduced stake after a loss — disciplined");
    } else if (inputs.stakeEscalationRatio >= 0.75 && inputs.stakeEscalationRatio <= 1.1) {
      delta += push(signals, "steady_sizing_after_loss", -5, "Kept stake steady after a loss — composed");
    }
  }

  // Disciplined consistent sizing (not chasing, not panicking)
  if (
    inputs.stakeEscalationRatio >= 0.88 &&
    inputs.stakeEscalationRatio <= 1.12 &&
    !inputs.lastTradeWasLoss
  ) {
    delta += push(signals, "disciplined_sizing", -5, "Disciplined stake sizing — no escalation");
  }

  // Reviewing portfolio / timeline is a calming signal
  if (inputs.viewingPhantomPortfolio) {
    delta += push(signals, "reviewing_phantoms", -6, "Reviewed phantom portfolio before entering");
  }
  if (inputs.viewingTimeline) {
    delta += push(signals, "reviewing_timeline", -6, "Reviewed branching timeline before entering");
  }

  // Composed entry — bonus for entering from a calm state
  if (inputs.currentScore <= 20 && inputs.consecutiveLosses === 0) {
    delta += push(signals, "composed_entry", -4, "Entered from a composed, streak-free state");
  }

  const newScore = Math.max(0, Math.min(100, inputs.currentScore + delta));
  return { score: newScore, zone: scoreToZone(newScore), signals };
}

/**
 * Evaluate tilt signals at the moment of TRADE RESOLUTION.
 * Rewards disciplined exits and penalises panic/impulsive closes.
 * Winning itself is not enough — HOW you won matters.
 */
export function calculateExitTilt(inputs: ResolutionTiltInputs): TiltCalculation {
  const signals: TiltSignal[] = [];
  let delta = 0;

  if (inputs.won) {
    // ── WIN PATH ──────────────────────────────────────────────────────────

    if (inputs.heldToExpiry) {
      // Best outcome: won AND had the conviction to hold the full duration
      delta += push(signals, "disciplined_win_held", -18, "Won and held to expiry — conviction paid off");
    } else {
      // Early exit that turned out profitable — smart risk management
      delta += push(signals, "smart_early_exit", -12, "Won with a smart early exit");
    }

    // Win streak bonuses — momentum compounds confidence
    if (inputs.winStreak >= 5) {
      delta += push(signals, "win_streak_5", -12, `${inputs.winStreak}-trade win streak — in the zone`);
    } else if (inputs.winStreak >= 3) {
      delta += push(signals, "win_streak_3", -8, `${inputs.winStreak}-trade win streak — building momentum`);
    }

    // Healthy session P&L
    if (inputs.sessionPnl > 100) {
      delta += push(signals, "session_strong", -6, "Session P&L strongly positive (> $100)");
    } else if (inputs.sessionPnl > 0) {
      delta += push(signals, "session_profitable", -3, "Session P&L in the green");
    }

    // Recovery from losing streak — extra reward
    if ((inputs.previousConsecutiveLosses ?? 0) > 0 && inputs.consecutiveLosses === 0 && inputs.winStreak === 1) {
      delta += push(signals, "streak_recovery", -5, "First win after a losing streak — recovered");
    }

  } else {
    // ── LOSS PATH ─────────────────────────────────────────────────────────

    if (!inputs.heldToExpiry) {
      // Worst behavioural outcome: bailed early AND still lost
      delta += push(signals, "panic_exit", 14, "Panic exit — sold early and still lost");
      if (inputs.consecutiveLosses > 1) {
        delta += push(signals, "chasing_loss_exit", 6, "Repeat panic exit during losing streak");
      }
    }
    // Held to expiry on a loss: no additional penalty — that's disciplined
    // (consecutive_losses handled at the next entry signal)
  }

  const newScore = Math.max(0, Math.min(100, inputs.currentScore + delta));
  return { score: newScore, zone: scoreToZone(newScore), signals };
}

/**
 * Legacy wrapper kept for backward compatibility with existing call sites.
 * Internally delegates to calculateEntryTilt.
 */
export function calculateTiltDelta(inputs: {
  consecutiveLosses: number;
  timeSinceLastTrade: number | null;
  timeSinceLastLoss: number | null;
  stakeEscalationRatio: number;
  isUnfamiliarAsset: boolean;
  viewingPhantomPortfolio: boolean;
  viewingTimeline: boolean;
  currentScore: number;
}): TiltCalculation {
  const inferredLastTradeWasLoss =
    inputs.consecutiveLosses > 0 &&
    inputs.timeSinceLastLoss !== null &&
    inputs.timeSinceLastTrade !== null &&
    inputs.timeSinceLastLoss <= inputs.timeSinceLastTrade;
  return calculateEntryTilt({
    currentScore: inputs.currentScore,
    consecutiveLosses: inputs.consecutiveLosses,
    timeSinceLastTradeMs: inputs.timeSinceLastTrade,
    timeSinceLastLossMs: inputs.timeSinceLastLoss,
    stakeEscalationRatio: inputs.stakeEscalationRatio,
    lastTradeWasLoss: inferredLastTradeWasLoss,
    isUnfamiliarAsset: inputs.isUnfamiliarAsset,
    sessionPnl: 0,
    viewingPhantomPortfolio: inputs.viewingPhantomPortfolio,
    viewingTimeline: inputs.viewingTimeline,
  });
}

export function applyTiltDecay(currentScore: number, minutesElapsed: number): number {
  // 2 pts/minute of inactivity — gradual natural recovery
  return Math.max(0, currentScore - minutesElapsed * 2);
}

export function scoreToZone(score: number): TiltZone {
  if (score <= 20) return "COMPOSED";
  if (score <= 40) return "WARMING";
  if (score <= 60) return "TILTING";
  if (score <= 80) return "ON_TILT";
  return "MELTDOWN";
}

export const TILT_ZONE_COLORS: Record<TiltZone, string> = {
  COMPOSED: "var(--color-success)",
  WARMING: "var(--color-warning)",
  TILTING: "#fb923c",
  ON_TILT: "var(--color-danger)",
  MELTDOWN: "#7f1d1d",
};

export const TILT_ZONE_LABELS: Record<TiltZone, string> = {
  COMPOSED: "COMPOSED",
  WARMING: "WARMING",
  TILTING: "TILTING",
  ON_TILT: "ON TILT",
  MELTDOWN: "MELTDOWN",
};

export const TILT_AMBIENT_CLASSES: Record<TiltZone, string> = {
  COMPOSED: "tilt-ambient-low",
  WARMING: "tilt-ambient-warming",
  TILTING: "tilt-ambient-tilting",
  ON_TILT: "tilt-ambient-on-tilt",
  MELTDOWN: "tilt-ambient-meltdown",
};
