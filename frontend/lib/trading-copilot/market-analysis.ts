'use strict';

import WebSocket from 'ws';
import { ATR, BollingerBands, EMA, MACD, RSI, SMA } from 'technicalindicators';
import { COPILOT_INTERVAL_MAP, DERIV_PUBLIC_WS } from '@/lib/trading-copilot/deriv-intervals';

export async function computeMarketAnalysis(
  symbol: string,
  timeframe?: string,
  indicators?: string[],
): Promise<Record<string, unknown>> {
  const granularity = COPILOT_INTERVAL_MAP[timeframe ?? '5m'] ?? 300;
  const count = 200;

  const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const ws = new WebSocket(DERIV_PUBLIC_WS);
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error('Deriv connection timed out'));
    }, 15000);

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          ticks_history: symbol,
          style: 'candles',
          granularity,
          count,
          end: 'latest',
          req_id: 1,
        }),
      );
    });

    ws.on('message', (msg: WebSocket.RawData) => {
      clearTimeout(timeout);
      try {
        const parsed = JSON.parse(String(msg)) as Record<string, unknown>;
        ws.close();
        resolve(parsed);
      } catch (e) {
        ws.close();
        reject(e instanceof Error ? e : new Error('Invalid Deriv response'));
      }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const errObj = data.error as { message?: string } | undefined;
  if (errObj) {
    throw new Error(errObj.message || 'Failed to fetch market data');
  }

  const candles = data.candles as
    | Array<{ epoch: number; open: number; high: number; low: number; close: number }>
    | undefined;

  if (!candles || candles.length === 0) {
    throw new Error('No candle data available for this symbol');
  }

  const closes = candles.map((c) => Number(c.close));
  const highs = candles.map((c) => Number(c.high));
  const lows = candles.map((c) => Number(c.low));
  const currentPrice = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2] ?? currentPrice;
  const priceChange = prevPrice !== 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

  const requestedIndicators = indicators ?? ['sma', 'rsi'];
  const result: Record<string, unknown> = {
    symbol,
    timeframe: timeframe ?? '5m',
    current_price: currentPrice,
    price_change_pct: Number(priceChange.toFixed(4)),
    candles_analyzed: candles.length,
    high_24: Math.max(
      ...highs.slice(-Math.min(highs.length, Math.floor(86400 / granularity))),
    ),
    low_24: Math.min(
      ...lows.slice(-Math.min(lows.length, Math.floor(86400 / granularity))),
    ),
  };

  if (requestedIndicators.includes('sma')) {
    const sma20 = SMA.calculate({ period: 20, values: closes });
    const sma50 = SMA.calculate({ period: 50, values: closes });
    result.sma_20 = sma20.length > 0 ? Number(sma20[sma20.length - 1].toFixed(5)) : null;
    result.sma_50 = sma50.length > 0 ? Number(sma50[sma50.length - 1].toFixed(5)) : null;
  }

  if (requestedIndicators.includes('ema')) {
    const ema20 = EMA.calculate({ period: 20, values: closes });
    result.ema_20 = ema20.length > 0 ? Number(ema20[ema20.length - 1].toFixed(5)) : null;
  }

  if (requestedIndicators.includes('rsi')) {
    const rsi = RSI.calculate({ period: 14, values: closes });
    result.rsi_14 = rsi.length > 0 ? Number(rsi[rsi.length - 1].toFixed(2)) : null;
  }

  if (requestedIndicators.includes('macd')) {
    const macd = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });
    const latest = macd[macd.length - 1];
    if (latest) {
      result.macd = {
        macd: latest.MACD ? Number(latest.MACD.toFixed(5)) : null,
        signal: latest.signal ? Number(latest.signal.toFixed(5)) : null,
        histogram: latest.histogram ? Number(latest.histogram.toFixed(5)) : null,
      };
    }
  }

  if (requestedIndicators.includes('bollinger')) {
    const bb = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
    const latest = bb[bb.length - 1];
    if (latest) {
      result.bollinger = {
        upper: Number(latest.upper.toFixed(5)),
        middle: Number(latest.middle.toFixed(5)),
        lower: Number(latest.lower.toFixed(5)),
      };
    }
  }

  if (requestedIndicators.includes('atr')) {
    const atr = ATR.calculate({
      period: 14,
      high: highs,
      low: lows,
      close: closes,
    });
    result.atr_14 = atr.length > 0 ? Number(atr[atr.length - 1].toFixed(5)) : null;
  }

  if (result.sma_20 != null && result.sma_50 != null) {
    result.trend =
      (result.sma_20 as number) > (result.sma_50 as number) ? 'bullish' : 'bearish';
  } else {
    result.trend = priceChange > 0 ? 'bullish' : 'bearish';
  }

  const recentRange = highs.slice(-20).map((h, i) => h - lows.slice(-20)[i]);
  const avgRange = recentRange.reduce((a, b) => a + b, 0) / Math.max(recentRange.length, 1);
  const rangeRatio = currentPrice !== 0 ? avgRange / currentPrice : 0;
  result.volatility = rangeRatio > 0.01 ? 'high' : rangeRatio > 0.003 ? 'medium' : 'low';

  return result;
}
