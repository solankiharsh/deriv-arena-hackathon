'use strict';

export type NudgeTier = 'subtle' | 'moderate' | 'strong' | 'celebration';

export interface ConversionThreshold {
  percentile: number;
  message: string;
  tier: NudgeTier;
  autoDismissMs: number | null;
}

export const LIVE_THRESHOLDS: ConversionThreshold[] = [
  {
    percentile: 70,
    message: "You're trading better than 70% of players. You've got real instincts.",
    tier: 'subtle',
    autoDismissMs: 5000,
  },
  {
    percentile: 80,
    message: "Top 20%! You're outperforming most traders in this competition.",
    tier: 'moderate',
    autoDismissMs: 5000,
  },
  {
    percentile: 85,
    message: "Outstanding! You've surpassed 85% of all traders. Ready to step into the real world?",
    tier: 'strong',
    autoDismissMs: null,
  },
  {
    percentile: 90,
    message: "Top 10%! Your edge is undeniable. The real markets are waiting.",
    tier: 'strong',
    autoDismissMs: null,
  },
  {
    percentile: 95,
    message: "Elite performance. You're in the top 5%. This isn't luck — this is skill.",
    tier: 'celebration',
    autoDismissMs: null,
  },
];

export const END_GAME_THRESHOLDS: ConversionThreshold[] = [
  {
    percentile: 70,
    message: 'You finished in the top 30%. You traded better than {pct}% of all players.',
    tier: 'moderate',
    autoDismissMs: null,
  },
  {
    percentile: 80,
    message: "Top 20% finish! You've proven your edge. Ready for real stakes?",
    tier: 'strong',
    autoDismissMs: null,
  },
  {
    percentile: 90,
    message: "Top 10 finish! You've proven your edge. Ready for real stakes?",
    tier: 'celebration',
    autoDismissMs: null,
  },
];

export function getNextLiveThreshold(
  percentile: number,
  highestShown: number,
): ConversionThreshold | null {
  for (const t of LIVE_THRESHOLDS) {
    if (percentile >= t.percentile && t.percentile > highestShown) {
      return t;
    }
  }
  return null;
}

export function getEndGameThreshold(
  percentile: number,
): ConversionThreshold | null {
  let best: ConversionThreshold | null = null;
  for (const t of END_GAME_THRESHOLDS) {
    if (percentile >= t.percentile) best = t;
  }
  return best;
}

export function interpolateMessage(message: string, percentile: number): string {
  return message.replace('{pct}', Math.round(percentile).toString());
}
