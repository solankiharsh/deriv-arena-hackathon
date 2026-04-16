"use strict";

export interface ChaosHeadline {
  id: string;
  text: string;
  source: string;
  volatilityMultiplier: number;
  directionBias: "bull" | "bear" | "neutral";
}

const HEADLINE_POOL: Omit<ChaosHeadline, "id">[] = [
  { text: "Elon Musk announces Mars-based cryptocurrency backed by red soil", source: "SpaceFinance", volatilityMultiplier: 2.5, directionBias: "bull" },
  { text: "Federal Reserve chair spotted buying crypto at a gas station ATM", source: "Bloomberg Parody", volatilityMultiplier: 2.0, directionBias: "bull" },
  { text: "AI trading bot achieves sentience, refuses to sell", source: "TechCrunch Fake", volatilityMultiplier: 3.0, directionBias: "neutral" },
  { text: "Breaking: World's largest hedge fund switches entirely to coin flips", source: "WSJ Satire", volatilityMultiplier: 1.8, directionBias: "neutral" },
  { text: "Mysterious whale moves $4.2B into unknown token — analysts baffled", source: "CryptoAlert", volatilityMultiplier: 2.2, directionBias: "bear" },
  { text: "Central bank accidentally prints extra trillion — 'It was a typo'", source: "Reuters Spoof", volatilityMultiplier: 2.8, directionBias: "bear" },
  { text: "Goldman Sachs intern leaks bullish thesis on meme stocks", source: "FinTwit", volatilityMultiplier: 1.5, directionBias: "bull" },
  { text: "Japan announces negative interest rates now apply to piggy banks", source: "Nikkei Parody", volatilityMultiplier: 2.0, directionBias: "bear" },
  { text: "Trading algorithm discovers infinite money glitch — patch incoming", source: "HackerNews", volatilityMultiplier: 3.0, directionBias: "neutral" },
  { text: "Oil prices surge after CEO claims 'we just ran out of dinosaurs'", source: "Energy Digest", volatilityMultiplier: 2.4, directionBias: "bull" },
  { text: "Swiss National Bank starts accepting payment in chocolate", source: "Alpine Finance", volatilityMultiplier: 1.6, directionBias: "neutral" },
  { text: "Flash crash blamed on cat walking across institutional keyboard", source: "Market Watch", volatilityMultiplier: 2.8, directionBias: "bear" },
  { text: "New study: 73% of profitable trades made during bathroom breaks", source: "Trade Psychology", volatilityMultiplier: 1.5, directionBias: "neutral" },
  { text: "BREAKING: Moon officially listed as collateral on major exchange", source: "DeFi Daily", volatilityMultiplier: 2.6, directionBias: "bull" },
  { text: "Legendary trader returns from 10-year hiatus — markets panic", source: "CNBC Fake", volatilityMultiplier: 2.2, directionBias: "bear" },
  { text: "Volatility index hits record high — analysts blame Mercury retrograde", source: "AstroFinance", volatilityMultiplier: 2.0, directionBias: "neutral" },
  { text: "Government announces surprise rate cut to stimulate meme economy", source: "FedWatch", volatilityMultiplier: 2.5, directionBias: "bull" },
  { text: "Major exchange goes offline — CEO says 'have you tried turning it off and on'", source: "CoinDesk Spoof", volatilityMultiplier: 3.0, directionBias: "bear" },
  { text: "World's richest man tweets single emoji — markets move 4%", source: "Twitter Finance", volatilityMultiplier: 2.3, directionBias: "bull" },
  { text: "Quantum computer successfully predicts next 5 candles — then crashes", source: "MIT Review", volatilityMultiplier: 2.7, directionBias: "neutral" },
  { text: "Retail traders collectively agree to 'just buy everything'", source: "Reddit Finance", volatilityMultiplier: 1.8, directionBias: "bull" },
  { text: "Bond market declares independence from equities — starts own country", source: "Fixed Income Daily", volatilityMultiplier: 1.7, directionBias: "neutral" },
];

let usedIndices = new Set<number>();

export function getRandomHeadline(): ChaosHeadline {
  if (usedIndices.size >= HEADLINE_POOL.length) {
    usedIndices.clear();
  }

  let idx: number;
  do {
    idx = Math.floor(Math.random() * HEADLINE_POOL.length);
  } while (usedIndices.has(idx));

  usedIndices.add(idx);
  const h = HEADLINE_POOL[idx];

  return {
    id: `chaos-${Date.now()}-${idx}`,
    ...h,
  };
}

export function getNextChaosInterval(): number {
  return 90_000 + Math.random() * 30_000;
}

export const CHAOS_DISPLAY_DURATION_MS = 5_000;
export const CHAOS_EFFECT_DURATION_MS = 15_000;
export const CHAOS_SCORE_MULTIPLIER = 1.5;

export function resetChaosEngine(): void {
  usedIndices.clear();
}
