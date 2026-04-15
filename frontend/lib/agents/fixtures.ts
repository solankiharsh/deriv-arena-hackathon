'use strict';

import type { MarketContext } from './types';

/** Build a simple synthetic context for tests and smoke scripts */
export function marketContextFixture(overrides: Partial<MarketContext> = {}): MarketContext {
  const base: MarketContext = {
    symbol: '1HZ100V',
    lastQuote: 1000,
    returns: [0.0001, -0.00005, 0.0002, 0.00015, -0.00002],
    sentimentPlaceholder: 0,
  };
  return { ...base, ...overrides };
}

export function contextFromSingleTick(symbol: string, quote: number): MarketContext {
  return {
    symbol,
    lastQuote: quote,
    returns: [],
    sentimentPlaceholder: 0,
  };
}
