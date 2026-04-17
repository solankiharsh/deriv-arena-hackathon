'use strict';

/**
 * Display helpers for Copilot widgets. Arena already ships a rich symbol layer
 * in `lib/deriv/symbols.ts`; this file is scoped to presentation-only formatting
 * used inside Copilot message parts so we don't couple widgets to the live
 * trade store.
 */

const SYMBOL_DISPLAY: Record<string, { name: string; market: string }> = {
  // Volatility indices
  R_10: { name: 'Volatility 10 Index', market: 'Synthetic' },
  R_25: { name: 'Volatility 25 Index', market: 'Synthetic' },
  R_50: { name: 'Volatility 50 Index', market: 'Synthetic' },
  R_75: { name: 'Volatility 75 Index', market: 'Synthetic' },
  R_100: { name: 'Volatility 100 Index', market: 'Synthetic' },
  '1HZ10V': { name: 'Volatility 10 (1s)', market: 'Synthetic' },
  '1HZ25V': { name: 'Volatility 25 (1s)', market: 'Synthetic' },
  '1HZ50V': { name: 'Volatility 50 (1s)', market: 'Synthetic' },
  '1HZ75V': { name: 'Volatility 75 (1s)', market: 'Synthetic' },
  '1HZ100V': { name: 'Volatility 100 (1s)', market: 'Synthetic' },

  BOOM500: { name: 'Boom 500 Index', market: 'Synthetic' },
  BOOM1000: { name: 'Boom 1000 Index', market: 'Synthetic' },
  CRASH500: { name: 'Crash 500 Index', market: 'Synthetic' },
  CRASH1000: { name: 'Crash 1000 Index', market: 'Synthetic' },

  stpRNG: { name: 'Step Index 100', market: 'Synthetic' },
  RDBULL: { name: 'Bull Market Index', market: 'Synthetic' },
  RDBEAR: { name: 'Bear Market Index', market: 'Synthetic' },

  frxEURUSD: { name: 'EUR/USD', market: 'Forex' },
  frxGBPUSD: { name: 'GBP/USD', market: 'Forex' },
  frxUSDJPY: { name: 'USD/JPY', market: 'Forex' },
  frxAUDUSD: { name: 'AUD/USD', market: 'Forex' },
  frxUSDCAD: { name: 'USD/CAD', market: 'Forex' },
  frxEURGBP: { name: 'EUR/GBP', market: 'Forex' },
  frxEURJPY: { name: 'EUR/JPY', market: 'Forex' },
  frxGBPJPY: { name: 'GBP/JPY', market: 'Forex' },

  cryBTCUSD: { name: 'BTC/USD', market: 'Crypto' },
  cryETHUSD: { name: 'ETH/USD', market: 'Crypto' },

  frxXAUUSD: { name: 'Gold/USD', market: 'Commodities' },
  frxXAGUSD: { name: 'Silver/USD', market: 'Commodities' },

  OTC_NDX: { name: 'US Tech 100', market: 'Indices' },
  OTC_SPC: { name: 'US 500', market: 'Indices' },
  OTC_DJI: { name: 'Wall Street 30', market: 'Indices' },
  OTC_FTSE: { name: 'UK 100', market: 'Indices' },
  OTC_GDAXI: { name: 'Germany 40', market: 'Indices' },
  OTC_N225: { name: 'Japan 225', market: 'Indices' },
};

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  CALL: 'Rise',
  PUT: 'Fall',
  DIGITMATCH: 'Digit Match',
  DIGITDIFF: 'Digit Differ',
  DIGITOVER: 'Digit Over',
  DIGITUNDER: 'Digit Under',
  DIGITEVEN: 'Digit Even',
  DIGITODD: 'Digit Odd',
  ONETOUCH: 'One Touch',
  NOTOUCH: 'No Touch',
  MULTUP: 'Multiplier Up',
  MULTDOWN: 'Multiplier Down',
};

const DURATION_UNIT_LABELS: Record<string, string> = {
  t: 'ticks',
  s: 'seconds',
  m: 'minutes',
  h: 'hours',
  d: 'days',
};

export function getSymbolDisplayName(symbol: string): string {
  return SYMBOL_DISPLAY[symbol]?.name ?? symbol;
}

export function getContractLabel(type: string): string {
  return CONTRACT_TYPE_LABELS[type] ?? type;
}

export function formatDuration(duration: number, unit: string): string {
  const label = DURATION_UNIT_LABELS[unit] ?? unit;
  return `${duration} ${label}`;
}

export function priceDecimals(symbol: string): number {
  if (symbol.startsWith('frx')) return 5;
  if (symbol.startsWith('cry')) return 2;
  return 2;
}

export const COPILOT_INTERVAL_SECONDS: Record<string, number> = {
  '1m': 60,
  '2m': 120,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};
