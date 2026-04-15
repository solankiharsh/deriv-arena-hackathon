'use strict';

import type { AgentProfileKnobs, AnalyzerResult, FusedDecision, TradeAction } from './types';
import type { AnalyzerId } from './types';

const DEFAULT_WEIGHT = 1;

function weightFor(id: AnalyzerId, knobs: AgentProfileKnobs): number {
  const w = knobs.analyzerWeights?.[id];
  return typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : DEFAULT_WEIGHT;
}

/**
 * Weighted fusion: positive score → CALL bias, negative → PUT.
 * Confidence blends magnitude and agreement across analyzers.
 */
export function fuseScores(analyzers: AnalyzerResult[], knobs: AgentProfileKnobs): FusedDecision {
  if (analyzers.length === 0) {
    return {
      score: 0,
      confidence: 0,
      action: 'HOLD',
      rationale: 'No analyzer outputs.',
    };
  }

  let num = 0;
  let den = 0;
  for (const a of analyzers) {
    const w = weightFor(a.id, knobs);
    num += w * a.score;
    den += w;
  }
  const fused = den > 0 ? num / den : 0;

  const meanAbs =
    analyzers.reduce((s, a) => s + Math.abs(a.score - fused), 0) / analyzers.length;
  const agreement = clamp01(1 - meanAbs / 2);
  const magnitude = clamp01(Math.abs(fused));
  const confidence = clamp01(0.55 * magnitude + 0.45 * agreement);

  let action: TradeAction = 'HOLD';
  if (confidence >= knobs.minConfidenceToTrade) {
    if (fused > 0.12) action = 'CALL';
    else if (fused < -0.12) action = 'PUT';
  }

  return {
    score: fused,
    confidence,
    action,
    rationale: `Fused ${fused.toFixed(3)} (conf ${confidence.toFixed(2)}) → ${action}.`,
  };
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
