'use strict';

/** Candle granularity in seconds for Deriv ticks_history */
export const COPILOT_INTERVAL_MAP: Record<string, number> = {
  '1m': 60,
  '2m': 120,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

export const DERIV_PUBLIC_WS = 'wss://api.derivws.com/trading/v1/options/ws/public';
