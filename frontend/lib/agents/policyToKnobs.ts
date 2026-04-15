'use strict';

import type { AgentPolicy } from './agentPolicy';
import type { AgentProfileKnobs, AnalyzerId } from './types';

export interface TradingRuntime {
  knobs: AgentProfileKnobs;
  maxOpenBars: number;
  returnsLookback: number;
}

function baseStakeAndCaps(policy: AgentPolicy): { base: number; maxPct: number } {
  let maxPct = 0.05;
  if (policy.identity.personality === 'careful_guardian') maxPct = 0.02;
  if (policy.identity.personality === 'bold_adventurer') maxPct = 0.09;

  if (policy.tradingStyle.profitDream === 'quick_wins') maxPct *= 0.65;
  if (policy.tradingStyle.profitDream === 'big_moves') maxPct *= 1.35;

  maxPct = Math.min(0.12, Math.max(0.01, maxPct));
  const cash = policy.deployment.paperStartingCash;
  const base = Math.max(5, Math.round(cash * maxPct));
  return { base, maxPct };
}

function maxOpenBarsFromPatience(patience: AgentPolicy['tradingStyle']['patience']): number {
  switch (patience) {
    case 'lightning_day':
      return 6;
    case 'swing_rider':
      return 14;
    case 'long_term_visionary':
      return 28;
    default:
      return 12;
  }
}

function returnsLookback(decision: AgentPolicy['identity']['decisionStyle']): number {
  switch (decision) {
    case 'gut_instinct':
      return 8;
    case 'deep_analyst':
      return 36;
    case 'patient_observer':
      return 48;
    default:
      return 24;
  }
}

function analyzerWeights(policy: AgentPolicy): Partial<Record<AnalyzerId, number>> {
  const w: Partial<Record<AnalyzerId, number>> = {};
  const { instinct } = policy.tradingStyle;
  const sense = policy.preferences.marketSense;

  if (instinct === 'trend_chaser') {
    w.momentum = 1.35;
    w.regime = 1.2;
  }
  if (instinct === 'reversal_spotter') {
    w.momentum = 0.85;
    w.probability = 1.25;
    w.regime = 1.15;
  }
  if (instinct === 'value_hunter') {
    w.probability = 1.2;
    w.risk = 1.15;
  }
  if (instinct === 'speed_demon') {
    w.momentum = 1.4;
    w.executionGuard = 0.85;
  }

  if (sense === 'mood_reader') {
    w.sentiment = 1.45;
    w.probability = (w.probability ?? 1) * 0.95;
  } else {
    w.sentiment = 0.65;
    w.probability = (w.probability ?? 1) * 1.05;
  }

  return w;
}

function riskBias(policy: AgentPolicy): number {
  let v = 0;
  if (policy.identity.personality === 'careful_guardian') v -= 0.45;
  if (policy.identity.personality === 'bold_adventurer') v += 0.45;
  if (policy.risk.protection === 'tight_guardian') v -= 0.25;
  if (policy.risk.protection === 'hands_off') v += 0.2;
  return Math.max(-1, Math.min(1, v));
}

function minConfidence(policy: AgentPolicy): number {
  let c = 0.42;
  if (policy.identity.decisionStyle === 'patient_observer') c += 0.14;
  if (policy.identity.decisionStyle === 'gut_instinct') c -= 0.08;
  if (policy.risk.protection === 'tight_guardian') c += 0.06;
  if (policy.risk.protection === 'hands_off') c -= 0.05;
  return Math.max(0.2, Math.min(0.85, c));
}

/**
 * Maps wizard policy + optional live stats into swarm knobs and paper timing.
 * `confidence` = last fused confidence [0,1]; `winStreak` = consecutive winning closed legs.
 */
export function policyToTradingRuntime(
  policy: AgentPolicy,
  stats: { winStreak: number; confidence: number; equityApprox: number },
): TradingRuntime {
  const { base, maxPct } = baseStakeAndCaps(policy);
  const maxStake = Math.max(base, Math.round(policy.deployment.paperStartingCash * maxPct * 1.8));

  let defaultStake = base;
  if (policy.risk.moneyApproach === 'fixed_safe') {
    defaultStake = base;
  }
  if (policy.risk.moneyApproach === 'smart_scaling') {
    const streakBoost = 1 + Math.min(5, stats.winStreak) * 0.06;
    const confBoost = 0.85 + 0.25 * Math.min(1, Math.max(0, stats.confidence));
    defaultStake = Math.round(base * streakBoost * confBoost);
  }
  if (policy.risk.moneyApproach === 'aggressive_sizer') {
    defaultStake = Math.round(base * (1.15 + 0.35 * Math.min(1, Math.max(0, stats.confidence))));
  }

  defaultStake = Math.max(5, Math.min(maxStake, defaultStake));
  if (defaultStake > stats.equityApprox * maxPct * 1.2) {
    defaultStake = Math.max(5, Math.floor(stats.equityApprox * maxPct));
  }

  return {
    knobs: {
      riskBias: riskBias(policy),
      maxStake,
      minConfidenceToTrade: minConfidence(policy),
      defaultStake,
      analyzerWeights: analyzerWeights(policy),
    },
    maxOpenBars: maxOpenBarsFromPatience(policy.tradingStyle.patience),
    returnsLookback: returnsLookback(policy.identity.decisionStyle),
  };
}

export function defaultSymbolForAsset(asset: AgentPolicy['preferences']['assetLove']): string {
  switch (asset) {
    case 'stocks_fan':
      return '1HZ100V';
    case 'forex_pro':
      return 'R_75';
    case 'crypto_rebel':
      return '1HZ100V';
    case 'all_rounder':
      return '1HZ75V';
    default:
      return '1HZ100V';
  }
}

export function sentimentFromPolicy(policy: AgentPolicy, personalityNote: string): number {
  if (policy.preferences.marketSense === 'fixed_rules') {
    return 0;
  }
  const t = personalityNote.trim();
  if (!t) return 0.05;
  return Math.max(-1, Math.min(1, (t.length / 280) * 0.35 - 0.1));
}
