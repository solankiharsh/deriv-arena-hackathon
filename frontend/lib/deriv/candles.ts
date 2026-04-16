"use strict";

import { derivWS } from "./websocket";
import type { TicksHistoryResponse } from "./types";
import type { CandlestickData, UTCTimestamp } from "lightweight-charts";

export interface LiveCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const GRANULARITY_SECONDS: Record<number, number> = {
  60: 60,
  300: 300,
  900: 900,
  3600: 3600,
};

export async function fetchCandleHistory(
  asset: string,
  granularity: number,
  count: number = 200
): Promise<CandlestickData[]> {
  const response = await derivWS.send({
    ticks_history: asset,
    style: "candles",
    granularity,
    count,
    end: "latest",
    adjust_start_time: 1,
  });

  const data = response as unknown as TicksHistoryResponse;
  if (!data.candles?.length) return [];

  return data.candles.map((c) => ({
    time: c.epoch as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}

export function aggregateTickToCandle(
  tickEpoch: number,
  tickQuote: number,
  currentCandle: LiveCandle | null,
  granularity: number
): { candle: LiveCandle; isNew: boolean } {
  const interval = GRANULARITY_SECONDS[granularity] ?? 60;
  const candleStart = Math.floor(tickEpoch / interval) * interval;

  if (currentCandle && currentCandle.time === candleStart) {
    return {
      candle: {
        ...currentCandle,
        high: Math.max(currentCandle.high, tickQuote),
        low: Math.min(currentCandle.low, tickQuote),
        close: tickQuote,
      },
      isNew: false,
    };
  }

  return {
    candle: {
      time: candleStart,
      open: tickQuote,
      high: tickQuote,
      low: tickQuote,
      close: tickQuote,
    },
    isNew: true,
  };
}
