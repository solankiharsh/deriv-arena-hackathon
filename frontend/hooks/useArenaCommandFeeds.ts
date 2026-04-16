'use strict';

import { useEffect, useMemo, useState } from 'react';
import { useDerivPublicTicks } from '@/hooks/useDerivPublicTicks';
import { useArenaFeedPreferences } from '@/hooks/useArenaFeedPreferences';
import { listCompetitions, type Competition } from '@/lib/derivarena-api';
import { loadAgentPolicyFromStorage, sentimentFromPolicy } from '@/lib/agents';
import { sampleStdDev, summarizePatternsFromReturns, type PatternSummary } from '@/lib/arena/patternSignals';

export interface PartnerFeedSnapshot {
  loading: boolean;
  error: string | null;
  competition: Competition | null;
}

export interface SentimentFeedSnapshot {
  /** Normalized [-1, 1] from local agent policy notes + archetype (Arena / Command Center). */
  policyScore: number;
  /** Rolling per-tick σ when Deriv returns available (stress proxy, not social media). */
  tickStressSigma: number | null;
  hint: string;
}

export function useArenaCommandFeeds() {
  const { selectedMarket, enabledFeeds } = useArenaFeedPreferences();
  const deriv = useDerivPublicTicks(selectedMarket, enabledFeeds.deriv_ticks);

  const [partner, setPartner] = useState<PartnerFeedSnapshot>({
    loading: false,
    error: null,
    competition: null,
  });

  useEffect(() => {
    if (!enabledFeeds.partner) {
      setPartner({ loading: false, error: null, competition: null });
      return;
    }
    let cancelled = false;
    setPartner({ loading: true, error: null, competition: null });
    listCompetitions('active')
      .then((rows) => {
        if (cancelled) return;
        const c =
          rows.find((x) => (x.partner_id && x.partner_id.length > 0) || (x.partner_name && x.partner_name.length > 0))
          ?? rows[0]
          ?? null;
        setPartner({ loading: false, error: null, competition: c });
      })
      .catch(() => {
        if (cancelled) return;
        setPartner({ loading: false, error: 'Could not load competitions', competition: null });
      });
    return () => {
      cancelled = true;
    };
  }, [enabledFeeds.partner]);

  const pattern: PatternSummary | null = useMemo(() => {
    if (!enabledFeeds.pattern) return null;
    if (!enabledFeeds.deriv_ticks) {
      return {
        window: 0,
        tickCount: 0,
        sigmaPerTick: null,
        lastReturn: null,
        regime: 'normal',
        headline: 'Turn on Deriv ticks to compute rolling volatility and regime labels from live returns.',
      };
    }
    return summarizePatternsFromReturns(deriv.returns);
  }, [enabledFeeds.pattern, enabledFeeds.deriv_ticks, deriv.returns]);

  const sentiment: SentimentFeedSnapshot | null = useMemo(() => {
    if (!enabledFeeds.sentiment) return null;
    const policy = loadAgentPolicyFromStorage();
    const policyScore = sentimentFromPolicy(policy, policy.preferences.strategyNotes);
    const w = deriv.returns.slice(-60);
    const tickStressSigma = w.length >= 8 ? sampleStdDev(w) : null;
    const hint =
      'Uses your local agent policy notes plus tick-stress from the Deriv feed when enabled — not X/Reddit yet.';
    return { policyScore, tickStressSigma, hint };
  }, [enabledFeeds.sentiment, deriv.returns]);

  return {
    selectedMarket,
    enabledFeeds,
    deriv,
    partner,
    pattern,
    sentiment,
  };
}
