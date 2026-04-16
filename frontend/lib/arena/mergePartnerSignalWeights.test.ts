'use strict';

import { describe, expect, it } from 'vitest';
import { mergePartnerRulesIntoKnobs } from './mergePartnerSignalWeights';
import type { AgentProfileKnobs } from '@/lib/agents/types';

const base: AgentProfileKnobs = {
  riskBias: 0.1,
  maxStake: 100,
  minConfidenceToTrade: 0.5,
  defaultStake: 20,
  analyzerWeights: { momentum: 2, sentiment: 1 },
};

describe('mergePartnerRulesIntoKnobs', () => {
  it('returns knobs unchanged when partner is null', () => {
    const out = mergePartnerRulesIntoKnobs(base, null);
    expect(out).toBe(base);
  });

  it('scales sentiment when host weight is high', () => {
    const out = mergePartnerRulesIntoKnobs(base, {
      data_source_weights: { sentiment: 10 },
    });
    // factor(10)=min(3,10/5)=2 → base sentiment 1 * 2
    expect(out.analyzerWeights?.sentiment).toBeCloseTo(2, 5);
  });

  it('applies market_bias to riskBias', () => {
    const out = mergePartnerRulesIntoKnobs(base, { market_bias: '1' });
    expect(out.riskBias).toBeGreaterThan(base.riskBias);
  });
});
