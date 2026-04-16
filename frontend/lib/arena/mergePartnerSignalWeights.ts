'use strict';

import type { AgentProfileKnobs, AnalyzerId } from '@/lib/agents/types';
import type { PartnerRules } from '@/lib/derivarena-api';

/** Map host weight 0–10 to a multiplier; 5 ≈ neutral. */
function dataSourceFactor(w: number | undefined): number {
  if (w == null || !Number.isFinite(w)) return 1;
  return Math.min(3, Math.max(0.2, w / 5));
}

/**
 * Applies `partner_rules.data_source_weights` and `market_bias` onto swarm knobs.
 * Weights multiply existing policy-derived `analyzerWeights` (defaults 1 per missing key).
 */
export function mergePartnerRulesIntoKnobs(
  knobs: AgentProfileKnobs,
  partner?: PartnerRules | null,
): AgentProfileKnobs {
  if (!partner) return knobs;

  const d = partner.data_source_weights;
  const fTicks = dataSourceFactor(d?.deriv_ticks);
  const fSent = dataSourceFactor(d?.sentiment);
  const fPat = dataSourceFactor(d?.pattern);
  const fPart = dataSourceFactor(d?.partner);

  const w: Partial<Record<AnalyzerId, number>> = { ...(knobs.analyzerWeights ?? {}) };
  const mul = (id: AnalyzerId, factor: number) => {
    w[id] = (w[id] ?? 1) * factor;
  };

  mul('momentum', (fTicks + fPat) / 2);
  mul('regime', (fTicks + fPat) / 2);
  mul('sentiment', fSent);
  mul('probability', fPat);
  mul('liquidity', (fPat + 1) / 2);
  mul('risk', fPart);
  mul('executionGuard', fPart);

  let riskBias = knobs.riskBias;
  if (partner.market_bias != null && String(partner.market_bias).trim() !== '') {
    const b = Number(partner.market_bias);
    if (Number.isFinite(b)) {
      riskBias = Math.max(-1, Math.min(1, riskBias + b * 0.35));
    }
  }

  return { ...knobs, analyzerWeights: w, riskBias };
}
