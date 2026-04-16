"use strict";

export interface GhostCandle {
  id: string;
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  opacity: number;
}

export interface FakeAlert {
  id: string;
  text: string;
  type: "bullish" | "bearish" | "system";
  timestamp: number;
}

const BULLISH_ALERTS = [
  "Bullish divergence detected on RSI",
  "Golden cross forming on 15m chart",
  "Support level holding — reversal incoming",
  "Whale accumulation pattern identified",
  "MACD crossover signals buy opportunity",
  "Volume spike suggests breakout imminent",
  "Double bottom pattern confirmed",
  "Institutional buying detected",
];

const BEARISH_ALERTS = [
  "Death cross forming on 5m chart",
  "Resistance rejection — sell signal active",
  "Distribution pattern detected at highs",
  "Rising wedge breakdown expected",
  "Bearish engulfing candle on higher TF",
  "Smart money exiting positions",
  "Head and shoulders top confirmed",
  "Overbought RSI — correction due",
];

const SYSTEM_ALERTS = [
  "System alert: Unusual order flow detected",
  "Warning: Liquidity thin in current range",
  "Notice: Volatility regime shift detected",
  "Alert: Correlation breakdown across pairs",
];

export function shouldShowHallucinations(bes: number): boolean {
  return bes < 40;
}

export function getHallucinationIntensity(bes: number): number {
  if (bes >= 40) return 0;
  return Math.min(1, (40 - bes) / 20);
}

export function generateGhostCandles(
  intensity: number,
  chartWidth: number,
  priceCenter: number,
  priceRange: number
): GhostCandle[] {
  const count = Math.floor(intensity * 4) + 1;
  const candles: GhostCandle[] = [];

  for (let i = 0; i < count; i++) {
    const x = Math.random() * chartWidth * 0.8 + chartWidth * 0.1;
    const bodySize = priceRange * (0.02 + Math.random() * 0.04);
    const wickExtend = bodySize * (0.3 + Math.random() * 0.7);
    const center = priceCenter + (Math.random() - 0.5) * priceRange * 0.3;
    const isBull = Math.random() < 0.5;

    candles.push({
      id: `ghost-${Date.now()}-${i}`,
      x,
      open: isBull ? center - bodySize / 2 : center + bodySize / 2,
      close: isBull ? center + bodySize / 2 : center - bodySize / 2,
      high: Math.max(center + bodySize / 2, center - bodySize / 2) + wickExtend,
      low: Math.min(center + bodySize / 2, center - bodySize / 2) - wickExtend,
      opacity: 0.15 + intensity * 0.2,
    });
  }

  return candles;
}

export function generateFakeAlert(intensity: number): FakeAlert | null {
  if (Math.random() > intensity * 0.3) return null;

  const pools = [
    { alerts: BULLISH_ALERTS, type: "bullish" as const },
    { alerts: BEARISH_ALERTS, type: "bearish" as const },
    { alerts: SYSTEM_ALERTS, type: "system" as const },
  ];

  const pool = pools[Math.floor(Math.random() * pools.length)];
  const text = pool.alerts[Math.floor(Math.random() * pool.alerts.length)];

  return {
    id: `fake-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    type: pool.type,
    timestamp: Date.now(),
  };
}

export function getPriceFlicker(
  realPrice: number,
  intensity: number
): number | null {
  if (Math.random() > intensity * 0.15) return null;
  const deviation = realPrice * (0.001 + Math.random() * 0.003) * intensity;
  return realPrice + (Math.random() < 0.5 ? deviation : -deviation);
}

export function getHeartRate(bes: number): number {
  if (bes >= 80) return 60;
  if (bes >= 50) return 60 + (80 - bes) * 1.5;
  if (bes >= 30) return 105 + (50 - bes) * 2;
  return 145 + (30 - bes) * 2.5;
}

export function getHeartRateColor(bes: number): string {
  if (bes >= 80) return "#22c55e";
  if (bes >= 50) return "#eab308";
  if (bes >= 30) return "#f97316";
  return "#ef4444";
}

export function getHeartRateAnimDuration(bpm: number): number {
  return 60 / bpm;
}
