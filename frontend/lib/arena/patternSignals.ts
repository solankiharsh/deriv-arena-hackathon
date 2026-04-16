'use strict';

/** Sample standard deviation (Bessel-corrected). */
export function sampleStdDev(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let acc = 0;
  for (const x of values) acc += (x - mean) ** 2;
  const v = acc / (n - 1);
  return Math.sqrt(Math.max(v, 0));
}

export type TickRegime = 'quiet' | 'normal' | 'agitated';

export interface PatternSummary {
  window: number;
  tickCount: number;
  sigmaPerTick: number | null;
  lastReturn: number | null;
  regime: TickRegime;
  /** One-line summary for operators (no fabricated win rates). */
  headline: string;
}

const QUIET = 0.00012;
const AGITATED = 0.00055;

function classifyRegime(sigma: number | null): TickRegime {
  if (sigma == null || !Number.isFinite(sigma)) return 'normal';
  if (sigma < QUIET) return 'quiet';
  if (sigma > AGITATED) return 'agitated';
  return 'normal';
}

/**
 * Lightweight pattern context from per-tick returns (same series as paper / swarm).
 * Not a full TA suite — realized vol + regime label for the Command Center.
 */
export function summarizePatternsFromReturns(returns: number[], window = 60): PatternSummary {
  const n = returns.length;
  const slice = returns.slice(-Math.min(window, Math.max(n, 0)));
  const sigma = slice.length >= 5 ? sampleStdDev(slice) : null;
  const lastReturn = n > 0 ? returns[n - 1]! : null;
  const regime = classifyRegime(sigma);
  let headline: string;
  if (n < 5) {
    headline = 'Collecting ticks — connect Deriv feed and wait a few seconds.';
  } else if (sigma == null) {
    headline = 'Not enough variance yet to classify regime.';
  } else {
    headline = `Rolling σ (per tick, last ${slice.length}) ≈ ${sigma.toExponential(2)} — ${regime} regime.`;
  }
  return {
    window: slice.length,
    tickCount: n,
    sigmaPerTick: sigma,
    lastReturn,
    regime,
    headline,
  };
}
