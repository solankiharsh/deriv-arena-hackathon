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

/** Mean return in units of its sample stdev — works for per-tick micro-returns. */
function zScoreMean(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const sd = stddev(xs);
  if (sd < 1e-12 || !Number.isFinite(sd)) return 0;
  return m / sd;
}

export function analyzeSentiment(ctx: MarketContext): AnalyzerResult {
  const policyS = clamp(ctx.sentimentPlaceholder, -1, 1);
  const w = ctx.returns.slice(-8);
  const tape =
    w.length >= 3 ? clamp(Math.tanh(zScoreMean(w) * 0.85), -1, 1) : 0;
  const score = clamp(0.35 * policyS + 0.65 * tape, -1, 1);
  const rationale =
    w.length < 3
      ? 'Thin tick history; sentiment from policy only.'
      : `Policy tilt ${policyS.toFixed(2)} + tick-flow tilt ${tape.toFixed(2)} (z of mean) → ${score.toFixed(2)}.`;
  return {
    id: 'sentiment',
    score,
    rationale,
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
  const r = ctx.returns.slice(-32);
  if (r.length < 4) {
    return {
      id: 'liquidity',
      score: 0.15,
      rationale: 'No L2 on public ticks; waiting for more prints for microstructure proxy.',
    };
  }
  const tickVol = stddev(r);
  const ref = Math.max(1e-8, mean(r.map((x) => Math.abs(x))) * 2.5);
  const choppiness = Math.min(2.5, tickVol / ref);
  const score = clamp(0.72 - choppiness * 0.55, -1, 1);
  return {
    id: 'liquidity',
    score,
    rationale: `Synthetic index: tick σ ${tickVol.toExponential(2)} vs typical |r| scale → execution friction proxy ${score.toFixed(2)}.`,
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
  const z = zScoreMean(window);
  const score = clamp(Math.sign(z) * Math.min(1, Math.abs(z) * 0.42), -1, 1);
  return {
    id: 'probability',
    score,
    rationale: `8-tick mean ${m.toExponential(2)} (z≈${z.toFixed(2)}) → probability tilt ${score.toFixed(2)}.`,
  };
}

export function analyzeMomentum(ctx: MarketContext): AnalyzerResult {
  const window = ctx.returns.slice(-5);
  if (window.length === 0) {
    return { id: 'momentum', score: 0, rationale: 'No returns; momentum flat.' };
  }
  const m = mean(window);
  const z = zScoreMean(window);
  const score = clamp(Math.sign(z) * Math.min(1, Math.abs(z) * 0.45), -1, 1);
  return {
    id: 'momentum',
    score,
    rationale: `5-tick mean ${m.toExponential(2)} (z≈${z.toFixed(2)}) → momentum ${score.toFixed(2)}.`,
  };
}

export function analyzeRegime(ctx: MarketContext): AnalyzerResult {
  const ret = ctx.returns;
  const volShort = stddev(ret.slice(-8));
  const volLong = stddev(ret.slice(-40)) || 1e-12;
  const ratio = volShort / volLong;
  if (ratio > 1.75 && volShort > 1e-9 && ret.length >= 12) {
    return {
      id: 'regime',
      score: clamp(-0.38 - Math.min(0.5, (ratio - 1.75) * 0.45), -1, 0.18),
      rationale: `Tick vol spike: short/long σ ratio ${ratio.toFixed(2)} (${volShort.toExponential(1)} vs ${volLong.toExponential(1)}).`,
    };
  }
  const w10 = ret.slice(-10);
  const z = zScoreMean(w10);
  const score = clamp(Math.sign(z) * Math.min(1, Math.abs(z) * 0.4), -1, 1);
  return {
    id: 'regime',
    score,
    rationale: `10-tick drift z≈${z.toFixed(2)} (σ mix stable) → regime ${score.toFixed(2)}.`,
  };
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
