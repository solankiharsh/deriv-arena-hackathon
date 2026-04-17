'use client';

import { useEffect, useRef, useState } from 'react';
import { derivWS } from '@/lib/deriv/websocket';
import {
  fetchCandleHistory,
  aggregateTickToCandle,
  type LiveCandle,
} from '@/lib/deriv/candles';
import { subscribeTicks, type TickEvent } from '@/lib/deriv/tick-bus';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { CandlestickData, UTCTimestamp } from 'lightweight-charts';
import { COPILOT_INTERVAL_SECONDS } from '@/lib/trading-copilot/widget-symbols';

export type CopilotChartState = {
  candles: CandlestickData[];
  latestCandle: LiveCandle | null;
  isLoading: boolean;
  error: string | null;
  wsConnected: boolean;
};

const HISTORY_COUNT = 200;

/**
 * Historical candles + live ticks aggregated into the current candle. Reuses the
 * existing arena `derivWS` singleton and `subscribeTicks` tick bus so copilot
 * widgets never open a second WebSocket.
 */
export function useCopilotChart(
  symbol: string | null,
  interval: string = '1m',
): CopilotChartState {
  const [candles, setCandles] = useState<CandlestickData[]>([]);
  const [latestCandle, setLatestCandle] = useState<LiveCandle | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(derivWS.connected);
  const currentCandleRef = useRef<LiveCandle | null>(null);
  const appId = useAuthStore((s) => s.appId);

  useEffect(() => {
    const unsub = derivWS.onConnectionChange((c) => setWsConnected(c));
    if (!derivWS.connected) {
      derivWS.connect(appId);
    }
    return unsub;
  }, [appId]);

  useEffect(() => {
    if (!symbol) return;
    if (!wsConnected) return;

    let cancelled = false;
    const granularity = COPILOT_INTERVAL_SECONDS[interval] ?? 60;

    setIsLoading(true);
    setError(null);
    currentCandleRef.current = null;

    (async () => {
      try {
        const history = await fetchCandleHistory(symbol, granularity, HISTORY_COUNT);
        if (cancelled) return;
        setCandles(history);
        const last = history[history.length - 1];
        if (last) {
          const lc: LiveCandle = {
            time: (last.time as UTCTimestamp) as number,
            open: last.open,
            high: last.high,
            low: last.low,
            close: last.close,
          };
          currentCandleRef.current = lc;
          setLatestCandle({ ...lc });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load chart data');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    const unsubTicks = subscribeTicks(symbol, (tick: TickEvent) => {
      const { candle, isNew } = aggregateTickToCandle(
        tick.epoch,
        tick.quote,
        currentCandleRef.current,
        granularity,
      );
      currentCandleRef.current = candle;
      setLatestCandle({ ...candle });

      if (isNew) {
        setCandles((prev) => [
          ...prev,
          {
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          },
        ]);
      } else {
        setCandles((prev) => {
          if (prev.length === 0) return prev;
          const next = prev.slice(0, -1);
          next.push({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          });
          return next;
        });
      }
    });

    return () => {
      cancelled = true;
      unsubTicks();
    };
  }, [symbol, interval, wsConnected]);

  return { candles, latestCandle, isLoading, error, wsConnected };
}
