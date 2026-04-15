'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import { useTradeStore } from '@/lib/stores/trade-store';
import { useAuthStore } from '@/lib/stores/auth-store';
import { derivWS } from '@/lib/deriv/websocket';
import { subscribeTicks } from '@/lib/deriv/tick-bus';
import { fetchCandleHistory, aggregateTickToCandle, type LiveCandle } from '@/lib/deriv/candles';

const GRANULARITY_OPTIONS = [
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '15m', value: 900 },
  { label: '1h', value: 3600 },
];

interface LiveChartProps {
  height?: number;
  compact?: boolean;
}

export function LiveChart({ height = 240, compact = false }: LiveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markerLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const unsubTicksRef = useRef<(() => void) | null>(null);
  const liveCandleRef = useRef<LiveCandle | null>(null);
  const mountedRef = useRef(true);

  const { selectedAsset, activePosition } = useTradeStore();
  const [granularity, setGranularity] = useState(60);
  const [isLoading, setIsLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(derivWS.connected);
  const [error, setError] = useState<string | null>(null);

  const displayName = useTradeStore(
    (s) => s.availableSymbols.find((sym) => sym.symbol === s.selectedAsset)?.display_name
  ) ?? selectedAsset;

  const priceChange = useMemo(() => {
    if (!lastPrice || !activePosition) return null;
    return lastPrice - activePosition.entrySpot;
  }, [lastPrice, activePosition]);

  useEffect(() => {
    const unsub = derivWS.onConnectionChange(setWsConnected);
    return unsub;
  }, []);

  const cleanup = useCallback(() => {
    if (unsubTicksRef.current) {
      unsubTicksRef.current();
      unsubTicksRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(148, 163, 184, 0.8)',
        fontFamily: 'var(--font-geist-mono, monospace)',
        fontSize: compact ? 9 : 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(232, 180, 94, 0.4)', width: 1, labelBackgroundColor: '#1a1a2e' },
        horzLine: { color: 'rgba(232, 180, 94, 0.4)', width: 1, labelBackgroundColor: '#1a1a2e' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.04)',
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.04)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b98180',
      wickDownColor: '#ef444480',
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    observer.observe(containerRef.current);

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [compact]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const loadAndSubscribe = async () => {
      setIsLoading(true);
      setError(null);
      liveCandleRef.current = null;
      cleanup();

      if (!seriesRef.current || !wsConnected) {
        setIsLoading(false);
        if (!wsConnected) setError('Market feed disconnected');
        return;
      }

      try {
        const history = await fetchCandleHistory(selectedAsset, granularity, 200);
        if (cancelled || !mountedRef.current) return;

        seriesRef.current.setData(history);
        chartRef.current?.timeScale().scrollToRealTime();

        if (history.length > 0) {
          setLastPrice(history[history.length - 1].close);
        }

        const unsub = subscribeTicks(selectedAsset, (tick) => {
          if (cancelled || !mountedRef.current) return;
          setLastPrice(tick.quote);

          const { candle } = aggregateTickToCandle(
            tick.epoch, tick.quote, liveCandleRef.current, granularity
          );
          liveCandleRef.current = candle;

          const candleData: CandlestickData = {
            time: candle.time as UTCTimestamp,
            open: candle.open, high: candle.high,
            low: candle.low, close: candle.close,
          };

          seriesRef.current?.update(candleData);
        });

        if (!cancelled) unsubTicksRef.current = unsub;
      } catch {
        setError('Unable to load chart data');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadAndSubscribe();
    return () => { cancelled = true; cleanup(); };
  }, [selectedAsset, granularity, cleanup, wsConnected]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (markerLineRef.current) {
      try { chartRef.current.removeSeries(markerLineRef.current); } catch { /* */ }
      markerLineRef.current = null;
    }

    if (activePosition && activePosition.entrySpot > 0) {
      const line = chartRef.current.addSeries(LineSeries, {
        color: activePosition.direction === 'CALL' ? '#10b981' : '#ef4444',
        lineWidth: 1, lineStyle: 2,
        priceLineVisible: true, lastValueVisible: true,
        crosshairMarkerVisible: false,
      });

      const now = Math.floor(Date.now() / 1000) as UTCTimestamp;
      line.setData([
        { time: (now - 3600) as UTCTimestamp, value: activePosition.entrySpot },
        { time: now as UTCTimestamp, value: activePosition.entrySpot },
      ]);
      markerLineRef.current = line;
    }
  }, [activePosition]);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <h3 className={`font-bold text-text-primary uppercase tracking-wide ${compact ? 'text-[10px]' : 'text-xs'}`}>
            {displayName}
          </h3>
          {lastPrice !== null && (
            <span className={`font-bold text-text-primary tabular-nums font-mono ${compact ? 'text-xs' : 'text-sm'}`}>
              {lastPrice.toFixed(2)}
            </span>
          )}
          {priceChange !== null && (
            <span className={`text-[10px] font-mono font-bold tabular-nums ${priceChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}
            </span>
          )}
          {isLoading && (
            <span className="text-[8px] text-text-muted animate-pulse">LOADING</span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGranularity(opt.value)}
              className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${
                granularity === opt.value
                  ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/20'
                  : 'text-text-muted hover:text-text-secondary border border-transparent'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} className="w-full" style={{ height }} />

      {/* Active position indicator */}
      {activePosition && activePosition.entrySpot > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-t border-white/[0.04]">
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
            activePosition.direction === 'CALL'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {activePosition.direction === 'CALL' ? 'RISE' : 'FALL'} @ {activePosition.entrySpot.toFixed(2)}
          </span>
          <span className="text-[9px] text-text-muted font-mono">
            Stake ${activePosition.stake}
          </span>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 text-[10px] text-red-400 border-t border-red-500/10 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => {
              const appId = useAuthStore.getState().appId;
              derivWS.connect(appId);
            }}
            className="px-2 py-0.5 rounded text-[9px] font-bold border border-red-500/20 hover:bg-red-500/10 transition-colors"
          >
            Reconnect
          </button>
        </div>
      )}
    </div>
  );
}
