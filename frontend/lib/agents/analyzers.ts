'use strict';

import type { AgentProfileKnobs, AnalyzerResult, MarketContext } from './types';
import type { AnalyzerId } from './types';

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const v = mean(xs.map((x) => (x - m) ** 2));
  return Math.sqrt(v);
}

export function analyzeSentiment(ctx: MarketContext): AnalyzerResult {
  const s = clamp(ctx.sentimentPlaceholder, -1, 1);
  return {
    id: 'sentiment',
    score: s,
    rationale: s === 0 ? 'No sentiment signal (neutral).' : `Sentiment placeholder ${s.toFixed(2)}.`,
  };
}

export function analyzeLiquidity(ctx: MarketContext): AnalyzerResult {
  if (ctx.bid != null && ctx.ask != null && ctx.bid > 0 && ctx.ask > 0) {
    const mid = (ctx.bid + ctx.ask) / 2;
    const spread = (ctx.ask - ctx.bid) / mid;
    const score = clamp(1 - Math.min(1, spread * 50), -1, 1);
    return {
      id: 'liquidity',
      score,
      rationale: `Spread ${(spread * 100).toFixed(3)}% of mid → liquidity score ${score.toFixed(2)}.`,
    };
  }
  return {
    id: 'liquidity',
    score: 0,
    rationale: 'No bid/ask; liquidity neutral.',
  };
}

export function analyzeRisk(ctx: MarketContext, knobs: AgentProfileKnobs): AnalyzerResult {
  const vol = stddev(ctx.returns.slice(-12));
  const raw = clamp(0.35 - vol * 80, -1, 1);
  const score = clamp(raw + knobs.riskBias * 0.25, -1, 1);
  return {
    id: 'risk',
    score,
    rationale: `Vol proxy ${vol.toFixed(4)} with riskBias → ${score.toFixed(2)}.`,
  };
}

export function analyzeProbability(ctx: MarketContext): AnalyzerResult {
  const window = ctx.returns.slice(-8);
  const m = mean(window);
  const score = clamp(Math.sign(m) * Math.min(1, Math.abs(m) * 120), -1, 1);
  return {
    id: 'probability',
    score,
    rationale: `Short-horizon drift ${m.toFixed(5)} → probability tilt ${score.toFixed(2)}.`,
  };
}

export function analyzeMomentum(ctx: MarketContext): AnalyzerResult {
  const window = ctx.returns.slice(-5);
  if (window.length === 0) {
    return { id: 'momentum', score: 0, rationale: 'No returns; momentum flat.' };
  }
  const m = mean(window);
  const score = clamp(Math.sign(m) * Math.min(1, Math.abs(m) * 100), -1, 1);
  return {
    id: 'momentum',
    score,
    rationale: `5-bar mean return ${m.toFixed(5)} → momentum ${score.toFixed(2)}.`,
  };
}

export function analyzeRegime(ctx: MarketContext): AnalyzerResult {
  const vol = stddev(ctx.returns.slice(-20));
  const sum = ctx.returns.slice(-10).reduce((a, b) => a + b, 0);
  if (vol > 0.004) {
    return {
      id: 'regime',
      score: clamp(-0.35 - knobsFromCtx(vol), -1, 0.2),
      rationale: 'High micro-vol regime; favor standing aside.',
    };
  }
  const score = clamp(Math.sign(sum) * Math.min(1, Math.abs(sum) * 60), -1, 1);
  return {
    id: 'regime',
    score,
    rationale: `Trend regime (10-bar sum ${sum.toFixed(5)}) → ${score.toFixed(2)}.`,
  };
}

function knobsFromCtx(vol: number): number {
  return Math.min(0.5, vol * 40);
}

export function analyzeExecutionGuard(ctx: MarketContext, knobs: AgentProfileKnobs): AnalyzerResult {
  if (ctx.returns.length < 2) {
    return {
      id: 'executionGuard',
      score: -0.75,
      rationale: 'Insufficient history for safe execution.',
    };
  }
  if (knobs.defaultStake > knobs.maxStake) {
    return {
      id: 'executionGuard',
      score: -1,
      rationale: 'defaultStake exceeds maxStake.',
    };
  }
  if (ctx.lastQuote <= 0) {
    return { id: 'executionGuard', score: -1, rationale: 'Invalid quote.' };
  }
  return {
    id: 'executionGuard',
    score: 0.85,
    rationale: 'Sizing and data checks passed.',
  };
}

const ORDER: AnalyzerId[] = [
  'sentiment',
  'liquidity',
  'risk',
  'probability',
  'momentum',
  'regime',
  'executionGuard',
];

export function runAllAnalyzers(ctx: MarketContext, knobs: AgentProfileKnobs): AnalyzerResult[] {
  return [
    analyzeSentiment(ctx),
    analyzeLiquidity(ctx),
    analyzeRisk(ctx, knobs),
    analyzeProbability(ctx),
    analyzeMomentum(ctx),
    analyzeRegime(ctx),
    analyzeExecutionGuard(ctx, knobs),
  ].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
}
