"use client";

import { useEffect, useRef, useCallback, useState } from "react";
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
} from "lightweight-charts";
import { useTradeStore } from "@/lib/stores/trade-store";
import { derivWS } from "@/lib/deriv/websocket";
import { subscribeTicks } from "@/lib/deriv/tick-bus";
import { fetchCandleHistory, aggregateTickToCandle, type LiveCandle } from "@/lib/deriv/candles";
import { GlassCard } from "@/components/shared/GlassCard";

const GRANULARITY_OPTIONS = [
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
  { label: "15m", value: 900 },
  { label: "1h", value: 3600 },
];

export function CandlestickChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markerLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const unsubTicksRef = useRef<(() => void) | null>(null);
  const liveCandleRef = useRef<LiveCandle | null>(null);
  const mountedRef = useRef(true);

  const { selectedAsset, activePosition } = useTradeStore();
  const [granularity, setGranularity] = useState(60);
  const [isLoading, setIsLoading] = useState(true);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [wsConnected, setWsConnected] = useState(derivWS.connected);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = derivWS.onConnectionChange(setWsConnected);
    return unsub;
  }, []);

  const displayName =
    useTradeStore((s) => s.availableSymbols.find((sym) => sym.symbol === s.selectedAsset)?.display_name) ??
    selectedAsset;

  const cleanup = useCallback(() => {
    if (unsubTicksRef.current) {
      unsubTicksRef.current();
      unsubTicksRef.current = null;
    }
  }, []);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "rgba(148, 163, 184, 0.8)",
        fontFamily: "var(--font-geist-mono), monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.03)" },
        horzLines: { color: "rgba(255, 255, 255, 0.03)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(139, 92, 246, 0.4)", width: 1, labelBackgroundColor: "#1e1b4b" },
        horzLine: { color: "rgba(139, 92, 246, 0.4)", width: 1, labelBackgroundColor: "#1e1b4b" },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b98180",
      wickDownColor: "#ef444480",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    return () => {
      mountedRef.current = false;
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load data and subscribe on asset/granularity change
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
        if (!wsConnected) setError("Live market feed is disconnected.");
        return;
      }

      try {
        const history = await fetchCandleHistory(selectedAsset, granularity, 200);

        if (cancelled || !mountedRef.current) return;

        seriesRef.current.setData(history);
        chartRef.current?.timeScale().scrollToRealTime();

        if (history.length > 0) {
          const last = history[history.length - 1];
          setLastPrice(last.close);
        }

        const unsub = subscribeTicks(selectedAsset, (tick) => {
          if (cancelled || !mountedRef.current) return;

          setLastPrice(tick.quote);

          const { candle, isNew } = aggregateTickToCandle(
            tick.epoch,
            tick.quote,
            liveCandleRef.current,
            granularity
          );

          liveCandleRef.current = candle;

          const candleData: CandlestickData = {
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          };

          if (seriesRef.current) {
            seriesRef.current.update(candleData);
          }

          if (isNew) {
            chartRef.current?.timeScale().scrollToRealTime();
          }
        });

        if (!cancelled) unsubTicksRef.current = unsub;
      } catch {
        setError("Unable to load candle history for this asset.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadAndSubscribe();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [selectedAsset, granularity, cleanup, wsConnected]);

  // Trade entry marker line
  useEffect(() => {
    if (!chartRef.current) return;

    if (markerLineRef.current) {
      try { chartRef.current.removeSeries(markerLineRef.current); } catch { /* */ }
      markerLineRef.current = null;
    }

    if (activePosition && activePosition.entrySpot > 0) {
      const line = chartRef.current.addSeries(LineSeries, {
        color: activePosition.direction === "CALL" ? "#10b981" : "#ef4444",
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: true,
        lastValueVisible: true,
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
    <GlassCard className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            {displayName}
          </h2>
          {lastPrice !== null && (
            <span className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums font-mono">
              {lastPrice.toFixed(2)}
            </span>
          )}
          {isLoading && (
            <span className="text-[9px] text-[var(--color-text-muted)]">Loading...</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGranularity(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                granularity === opt.value
                  ? "bg-[var(--color-phantom-dim)] text-[var(--color-phantom)] border border-[var(--color-phantom)]/20"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] border border-transparent"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden"
        style={{ height: 280 }}
      />

      {(error || !wsConnected) && (
        <div className="mt-3 rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger-dim)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
          {error ?? "Market feed is offline. Reconnect to continue streaming candles."}
        </div>
      )}

      {activePosition && activePosition.entrySpot > 0 && (
        <div className="mt-2 flex items-center gap-2 text-[10px]">
          <span
            className={`px-2 py-0.5 rounded-full font-bold ${
              activePosition.direction === "CALL"
                ? "bg-[var(--color-success-dim)] text-[var(--color-success)]"
                : "bg-[var(--color-danger-dim)] text-[var(--color-danger)]"
            }`}
          >
            {activePosition.direction === "CALL" ? "RISE" : "FALL"} @ {activePosition.entrySpot.toFixed(2)}
          </span>
          <span className="text-[var(--color-text-muted)]">
            Stake ${activePosition.stake}
          </span>
        </div>
      )}
    </GlassCard>
  );
}
