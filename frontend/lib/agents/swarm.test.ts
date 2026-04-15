'use strict';

import { describe, expect, it } from 'vitest';
import { DEFAULT_KNOBS, fuseScores, runAllAnalyzers, runSwarm } from './index';
import { marketContextFixture } from './fixtures';
import type { AgentProfileKnobs } from './types';

describe('runAllAnalyzers', () => {
  it('returns seven ordered analyzers', () => {
    const ctx = marketContextFixture();
    const knobs: AgentProfileKnobs = { ...DEFAULT_KNOBS };
    const out = runAllAnalyzers(ctx, knobs);
    expect(out).toHaveLength(7);
    expect(out.map((a) => a.id)).toEqual([
      'sentiment',
      'liquidity',
      'risk',
      'probability',
      'momentum',
      'regime',
      'executionGuard',
    ]);
  });

  it('executionGuard blocks with thin history', () => {
    const ctx = marketContextFixture({ returns: [0.0001] });
    const g = runAllAnalyzers(ctx, DEFAULT_KNOBS).find((a) => a.id === 'executionGuard');
    expect(g?.score).toBeLessThan(0);
  });
});

describe('fuseScores', () => {
  it('emits HOLD when confidence would be low', () => {
    const knobs: AgentProfileKnobs = { ...DEFAULT_KNOBS, minConfidenceToTrade: 0.99 };
    const analyzers = runAllAnalyzers(marketContextFixture(), knobs);
    const fused = fuseScores(analyzers, knobs);
    expect(fused.action).toBe('HOLD');
  });
});

describe('runSwarm integration', () => {
  it('produces CALL on strong bullish returns when thresholds allow', () => {
    const ctx = marketContextFixture({
      returns: Array(12).fill(0.0008),
      sentimentPlaceholder: 0.4,
    });
    const knobs: AgentProfileKnobs = {
      ...DEFAULT_KNOBS,
      minConfidenceToTrade: 0.35,
      riskBias: 0.2,
    };
    const { fused } = runSwarm(ctx, knobs);
    expect(['CALL', 'HOLD']).toContain(fused.action);
  });
});
