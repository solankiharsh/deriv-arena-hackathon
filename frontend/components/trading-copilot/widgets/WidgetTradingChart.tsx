'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useCopilotChart } from '@/lib/trading-copilot/use-copilot-chart';
import {
  getSymbolDisplayName,
  priceDecimals,
} from '@/lib/trading-copilot/widget-symbols';

export type CopilotTradingChartData = {
  symbol: string;
  interval?: string;
  title?: string;
  show_indicators?: string[];
};

const INTERVAL_OPTIONS = ['1m', '5m', '15m', '1h', '4h', '1d'];

export function WidgetTradingChart({ data }: { data: CopilotTradingChartData }) {
  const { symbol, interval: initialInterval, title, show_indicators } = data;
  const [interval, setInterval] = useState<string>(initialInterval || '1m');

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
  const smaSeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null);

  const { candles, latestCandle, isLoading, error, wsConnected } =
    useCopilotChart(symbol, interval);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#a1a1aa',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      width: containerRef.current.clientWidth,
      height: 320,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255,255,255,0.1)',
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 3 },
        horzLine: { color: 'rgba(255,255,255,0.2)', width: 1, style: 3 },
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      smaSeriesRef.current = null;
    };
  }, []);

  const drawSma = useCallback((input: CandlestickData[], period: number) => {
    if (!chartRef.current) return;
    if (smaSeriesRef.current) {
      chartRef.current.removeSeries(smaSeriesRef.current);
    }
    const smaSeries = chartRef.current.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const out: Array<{ time: Time; value: number }> = [];
    for (let i = period - 1; i < input.length; i++) {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += input[j].close;
      out.push({ time: input[i].time as Time, value: sum / period });
    }
    smaSeries.setData(out);
    smaSeriesRef.current = smaSeries;
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;
    const formatted = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeriesRef.current.setData(formatted);
    chartRef.current?.timeScale().fitContent();

    if (show_indicators?.includes('sma_20') && candles.length >= 20) {
      drawSma(candles, 20);
    } else if (show_indicators?.includes('sma_50') && candles.length >= 50) {
      drawSma(candles, 50);
    }
  }, [candles, show_indicators, drawSma]);

  useEffect(() => {
    if (!candleSeriesRef.current || !latestCandle) return;
    candleSeriesRef.current.update({
      time: latestCandle.time as UTCTimestamp,
      open: latestCandle.open,
      high: latestCandle.high,
      low: latestCandle.low,
      close: latestCandle.close,
    });
  }, [latestCandle]);

  const decimals = priceDecimals(symbol);
  const fmt = (v: number) => v.toFixed(decimals);
  const displayName = title || getSymbolDisplayName(symbol);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{displayName}</h3>
          <span className="text-[11px] text-text-muted font-mono">{symbol}</span>
          {wsConnected ? (
            <Wifi className="h-3 w-3 text-accent-primary" />
          ) : (
            <WifiOff className="h-3 w-3 text-error" />
          )}
        </div>
        <div className="flex gap-0.5">
          {INTERVAL_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setInterval(opt)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                interval === opt
                  ? 'bg-accent-primary text-black'
                  : 'text-text-muted hover:bg-bg-secondary hover:text-text-primary'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/70">
            <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
            <p className="text-sm text-error">{error}</p>
          </div>
        ) : null}
        <div ref={containerRef} className="h-80" />
      </div>

      {latestCandle ? (
        <div className="border-t border-border px-4 py-1.5">
          <div className="flex flex-wrap items-center gap-4 text-[11px] font-mono">
            <span className="text-text-muted">
              O <span className="text-text-primary">{fmt(latestCandle.open)}</span>
            </span>
            <span className="text-text-muted">
              H <span className="text-accent-primary">{fmt(latestCandle.high)}</span>
            </span>
            <span className="text-text-muted">
              L <span className="text-error">{fmt(latestCandle.low)}</span>
            </span>
            <span className="text-text-muted">
              C <span className="text-text-primary">{fmt(latestCandle.close)}</span>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
