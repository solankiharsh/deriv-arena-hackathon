'use strict';

/** Preset categories for the Ideas gallery (Trading Copilot). */
export const COPILOT_IDEA_CATEGORIES = [
  'all',
  'charts',
  'signals',
  'analysis',
  'trading',
  'learning',
] as const;

export type CopilotIdeaCategory = (typeof COPILOT_IDEA_CATEGORIES)[number];

export type CopilotIdea = {
  id: string;
  title: string;
  description: string;
  /** Primary filter tab */
  category: Exclude<CopilotIdeaCategory, 'all'>;
  /** Shown on the card */
  badges?: string[];
  /** Sent as the first user message (model should use Deriv symbols, e.g. frxEURUSD, R_75). */
  prompt: string;
};

/**
 * Curated starter prompts — Deriv-oriented symbols inline so the assistant can call analyze_market / charts.
 */
export const COPILOT_IDEAS: CopilotIdea[] = [
  {
    id: 'eurusd-rsi-bb',
    title: 'EUR/USD with RSI and Bollinger Bands',
    description: 'Multi-timeframe read on the euro-dollar using momentum and volatility bands.',
    category: 'analysis',
    badges: ['Popular', 'Analysis'],
    prompt:
      'Analyze frxEURUSD (EUR/USD) on 1-hour candles with RSI and Bollinger Bands. Summarize trend, band squeeze or expansion, and key levels. Use analyze_market with symbol frxEURUSD, timeframe 1h, indicators rsi and bollinger.',
  },
  {
    id: 'btc-4h-bb',
    title: 'Bitcoin 4-hour with Bollinger Bands',
    description: 'Spot squeezes and band walks on crypto with a higher timeframe.',
    category: 'charts',
    badges: ['Charts'],
    prompt:
      'Show cryBTCUSD on 4-hour candles with Bollinger Bands. Call analyze_market for cryBTCUSD, timeframe 4h, indicators bollinger and rsi, then show_trading_chart with the same symbol and interval 4h and show_indicators including bollinger.',
  },
  {
    id: 'gold-silver',
    title: 'Gold vs silver — relative strength',
    description: 'Compare precious metals momentum and recent performance side by side.',
    category: 'analysis',
    badges: ['Analysis'],
    prompt:
      'Compare frxXAUUSD (gold) and frxXAGUSD (silver): run analyze_market for each on 1h with rsi and sma, then summarize which is stronger and any divergence.',
  },
  {
    id: 'eth-15m',
    title: 'Ethereum on 15-minute candles',
    description: 'Short-term structure and momentum for ETH vs USD.',
    category: 'charts',
    badges: ['Charts'],
    prompt:
      'Analyze cryETHUSD on 15m candles with EMA and RSI. Use analyze_market with indicators ema and rsi, then offer a concise intraday read.',
  },
  {
    id: 'gold-5m',
    title: 'Gold intraday (5-minute)',
    description: 'Tighter timeframe for scalping-style context on gold.',
    category: 'charts',
    badges: ['Charts'],
    prompt:
      'Analyze frxXAUUSD on 5m with bollinger and rsi. Use analyze_market and comment on micro-trend and band position.',
  },
  {
    id: 'volatility-75-sma',
    title: 'Volatility Index 75 with SMA overlay',
    description: 'Synthetic index trend and mean-reversion cues with moving averages.',
    category: 'charts',
    badges: ['Charts'],
    prompt:
      'Analyze R_75 on 5m candles with SMA and RSI (use analyze_market symbol R_75, indicators sma and rsi). Then show_trading_chart for R_75, interval 5m, show_indicators sma_20 and sma_50 if available.',
  },
  {
    id: 'crash-spike-signals',
    title: 'Crash index — spike frequency read',
    description: 'Discuss spike cadence and risk framing for crash-style synthetics.',
    category: 'signals',
    badges: ['Signals'],
    prompt:
      'Analyze CRASH1000 on 1m candles with ATR and RSI using analyze_market. Summarize spike cadence and risk framing — no trade recommendation without my explicit confirmation.',
  },
  {
    id: 'btc-vs-eth',
    title: 'BTC vs ETH — which is leading?',
    description: 'Relative performance and correlation snapshot.',
    category: 'analysis',
    badges: ['Charts', 'Analysis'],
    prompt:
      'Compare cryBTCUSD vs cryETHUSD on 4h: two analyze_market calls with rsi and macd, then state which asset is leading and why.',
  },
  {
    id: 'gbp-usd-macd',
    title: 'Cable (GBP/USD) MACD + trend',
    description: 'Momentum crossover context on sterling.',
    category: 'analysis',
    badges: ['Analysis'],
    prompt:
      'Analyze frxGBPUSD on 1h with MACD and SMA. Use analyze_market with indicators macd and sma and explain trend vs momentum.',
  },
  {
    id: 'usd-jpy-levels',
    title: 'USD/JPY — levels and ATR',
    description: 'Volatility-adjusted support and resistance discussion.',
    category: 'trading',
    badges: ['Trading'],
    prompt:
      'Analyze frxUSDJPY on 1h with ATR and bollinger. Use analyze_market with indicators atr and bollinger; describe volatility regime and key areas.',
  },
  {
    id: 'risk-position-sizing',
    title: 'Position sizing from a risk budget',
    description: 'Educational walkthrough — no live execution.',
    category: 'learning',
    badges: ['Learning'],
    prompt:
      'Explain how to size a binary options trade given a 2% account risk rule and a payout — use formulas and a numeric example. Do not place_trade unless I explicitly ask to draft a ticket.',
  },
  {
    id: 'rsi-divergence-explainer',
    title: 'How RSI divergence works',
    description: 'Concepts for spotting bullish vs bearish divergence on charts.',
    category: 'learning',
    badges: ['Learning'],
    prompt:
      'Teach RSI bullish and bearish divergence with a simple checklist. Optionally reference a generic forex pair example without needing live data.',
  },
  {
    id: 'leaderboard-motivation',
    title: 'Arena leaderboard mindset',
    description: 'Healthy competition habits and discipline metrics.',
    category: 'learning',
    badges: ['Learning'],
    prompt:
      'Give practical tips for improving consistency on a trading leaderboard: journaling, drawdown rules, and when to stop for the day.',
  },
  {
    id: 'volatility-25-50-75',
    title: 'Compare Volatility 25, 50, and 75',
    description: 'Relative volatility regimes across synthetic indices.',
    category: 'analysis',
    badges: ['Analysis'],
    prompt:
      'Compare R_25, R_50, and R_75 using analyze_market on 15m with rsi for each — summarize which shows the hottest volatility right now.',
  },
  {
    id: 'boom-style-overview',
    title: 'Boom-style synthetic — structure overview',
    description: 'Educational overview of boom/crash style price behavior.',
    category: 'learning',
    badges: ['Learning'],
    prompt:
      'Explain how boom/crash-style synthetic indices typically behave vs trending forex, and what risk controls matter. Keep it educational.',
  },
];

export function ideasForCategory(tab: CopilotIdeaCategory): CopilotIdea[] {
  if (tab === 'all') return COPILOT_IDEAS;
  return COPILOT_IDEAS.filter((i) => i.category === tab);
}
