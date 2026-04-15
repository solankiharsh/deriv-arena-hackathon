'use strict';

import { fuseScores } from './fuse';
import { runAllAnalyzers } from './analyzers';
import type { AgentProfileKnobs, MarketContext, SwarmResult } from './types';

export type { AgentProfileKnobs, AnalyzerId, AnalyzerResult, FusedDecision, MarketContext, SwarmResult, TradeAction } from './types';

export { fuseScores } from './fuse';
export { runAllAnalyzers } from './analyzers';

export const DEFAULT_KNOBS: AgentProfileKnobs = {
  riskBias: 0,
  maxStake: 100,
  minConfidenceToTrade: 0.42,
  defaultStake: 10,
};

export function runSwarm(ctx: MarketContext, knobs: AgentProfileKnobs): SwarmResult {
  const analyzers = runAllAnalyzers(ctx, knobs);
  const fused = fuseScores(analyzers, knobs);
  return { analyzers, fused };
}
