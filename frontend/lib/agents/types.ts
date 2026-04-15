'use strict';

export type TradeAction = 'HOLD' | 'CALL' | 'PUT';

export type AnalyzerId =
  | 'sentiment'
  | 'liquidity'
  | 'risk'
  | 'probability'
  | 'momentum'
  | 'regime'
  | 'executionGuard';

export interface MarketContext {
  symbol: string;
  lastQuote: number;
  /** Recent fractional changes (e.g. r_t = (p_t - p_{t-1})/p_{t-1}), oldest first */
  returns: number[];
  /** Optional normalized sentiment in [-1, 1] */
  sentimentPlaceholder: number;
  bid?: number;
  ask?: number;
}

export interface AgentProfileKnobs {
  /** -1 very cautious … +1 aggressive */
  riskBias: number;
  maxStake: number;
  /** Minimum fused confidence [0,1] required to emit CALL/PUT */
  minConfidenceToTrade: number;
  /** Default stake when opening a paper position */
  defaultStake: number;
  /** Per-analyzer weights; omitted keys default to 1 */
  analyzerWeights?: Partial<Record<AnalyzerId, number>>;
}

export interface AnalyzerResult {
  id: AnalyzerId;
  score: number;
  rationale: string;
}

export interface FusedDecision {
  score: number;
  confidence: number;
  action: TradeAction;
  rationale: string;
}

export interface SwarmResult {
  analyzers: AnalyzerResult[];
  fused: FusedDecision;
}
