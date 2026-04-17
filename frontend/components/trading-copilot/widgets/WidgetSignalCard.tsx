'use client';

import React from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  formatDuration,
  getContractLabel,
  getSymbolDisplayName,
  priceDecimals,
} from '@/lib/trading-copilot/widget-symbols';

export type CopilotSignalCardData = {
  symbol: string;
  direction: 'CALL' | 'PUT';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  suggested_duration?: number;
  suggested_duration_unit?: string;
  suggested_amount?: number;
  current_price?: number;
  price_change_pct?: number;
  rsi?: number;
  sma_20?: number;
  sma_50?: number;
  macd?: { macd: number; signal: number; histogram: number };
  bollinger?: { upper: number; middle: number; lower: number };
  trend?: string;
  volatility?: string;
  atr?: number;
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-accent-primary/15 text-accent-primary',
  medium: 'bg-amber-500/15 text-amber-400',
  low: 'bg-bg-secondary text-text-muted',
};

function RsiGauge({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = (clamped / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 60;
  const cy = 55;
  const r = 40;
  const startX = cx - r;
  const startY = cy;
  const endX = cx + r * Math.cos(Math.PI - rad);
  const endY = cy - r * Math.sin(Math.PI - rad);
  const largeArc = angle > 90 ? 1 : 0;
  const color = clamped >= 70 ? '#ef4444' : clamped <= 30 ? '#22c55e' : '#f59e0b';
  const zone = clamped >= 70 ? 'Overbought' : clamped <= 30 ? 'Oversold' : 'Neutral';

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="6"
        />
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <text x={cx} y={cy - 8} textAnchor="middle" className="fill-text-primary text-lg font-semibold">
          {clamped.toFixed(1)}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" className="fill-text-muted text-[9px]">
          {zone}
        </text>
      </svg>
    </div>
  );
}

function MacdBars({ histogram, macd, signal }: { histogram: number; macd: number; signal: number }) {
  const isPositive = histogram >= 0;
  const barHeight = Math.min(Math.abs(histogram) * 800, 40);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex h-12 w-full items-end justify-center gap-[2px]">
        {[-3, -2, -1, 0, 1, 2, 3].map((offset) => {
          const h = Math.max(4, barHeight - Math.abs(offset) * 6);
          return (
            <div
              key={offset}
              className={`w-3 rounded-sm transition-all ${isPositive ? 'bg-accent-primary' : 'bg-error'}`}
              style={{ height: `${h}px`, opacity: 1 - Math.abs(offset) * 0.12 }}
            />
          );
        })}
      </div>
      <div className="flex w-full justify-between text-[10px] text-text-muted">
        <span>MACD {macd.toFixed(4)}</span>
        <span>Signal {signal.toFixed(4)}</span>
      </div>
    </div>
  );
}

function BollingerBar({
  price,
  upper,
  middle,
  lower,
}: {
  price: number;
  upper: number;
  middle: number;
  lower: number;
}) {
  const range = upper - lower;
  const pos = range > 0 ? ((price - lower) / range) * 100 : 50;
  const clamped = Math.max(0, Math.min(100, pos));

  return (
    <div className="space-y-2">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-bg-secondary">
        <div className="absolute inset-y-0 left-[10%] right-[10%] rounded-full bg-white/10" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-primary shadow"
          style={{ left: `${clamped}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-muted">
        <span>L {lower.toFixed(2)}</span>
        <span>M {middle.toFixed(2)}</span>
        <span>U {upper.toFixed(2)}</span>
      </div>
    </div>
  );
}

function SimpleSignalCard({ data }: { data: CopilotSignalCardData }) {
  const isRise = data.direction === 'CALL';
  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent-primary" />
          <h3 className="text-sm font-semibold text-text-primary">Trading Signal</h3>
        </div>
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${CONFIDENCE_STYLES[data.confidence]}`}
        >
          {data.confidence}
        </span>
      </div>
      <div className="space-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${isRise ? 'bg-accent-primary/15' : 'bg-error/15'}`}
          >
            {isRise ? (
              <ArrowUp className="h-5 w-5 text-accent-primary" />
            ) : (
              <ArrowDown className="h-5 w-5 text-error" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {getContractLabel(data.direction)} on {getSymbolDisplayName(data.symbol)}
            </p>
            <p className="text-xs text-text-muted font-mono">{data.symbol}</p>
          </div>
        </div>
        <p className="text-sm text-text-primary/90">{data.reasoning}</p>
        {data.suggested_duration && data.suggested_duration_unit ? (
          <div className="flex gap-4 text-xs text-text-muted">
            <span>Duration: {formatDuration(data.suggested_duration, data.suggested_duration_unit)}</span>
            {data.suggested_amount ? <span>Stake: ${data.suggested_amount}</span> : null}
          </div>
        ) : null}
        <p className="text-[10px] text-text-muted">
          Signals are AI-generated and not financial advice.
        </p>
      </div>
    </div>
  );
}

export function WidgetSignalCard({ data }: { data: CopilotSignalCardData }) {
  const isRise = data.direction === 'CALL';
  const hasIndicators =
    data.rsi != null || data.macd != null || data.bollinger != null;

  if (!hasIndicators) {
    return <SimpleSignalCard data={data} />;
  }

  const decimals = priceDecimals(data.symbol);

  return (
    <div className="my-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        <div className="col-span-2 md:col-span-1 md:row-span-2 rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-accent-primary" />
            <span className="text-[11px] font-semibold text-text-muted">SIGNAL</span>
            <span
              className={`ml-auto rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${CONFIDENCE_STYLES[data.confidence]}`}
            >
              {data.confidence}
            </span>
          </div>

          <div className="mb-3 flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${isRise ? 'bg-accent-primary/15' : 'bg-error/15'}`}
            >
              {isRise ? (
                <ArrowUp className="h-6 w-6 text-accent-primary" />
              ) : (
                <ArrowDown className="h-6 w-6 text-error" />
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-text-primary">
                {getContractLabel(data.direction)}
              </p>
              <p className="text-xs text-text-muted">{getSymbolDisplayName(data.symbol)}</p>
            </div>
          </div>

          <p className="text-sm leading-relaxed text-text-primary/80">{data.reasoning}</p>

          {data.suggested_duration || data.suggested_amount ? (
            <div className="mt-3 flex gap-3 text-xs text-text-muted">
              {data.suggested_duration && data.suggested_duration_unit ? (
                <span>{formatDuration(data.suggested_duration, data.suggested_duration_unit)}</span>
              ) : null}
              {data.suggested_amount ? <span>${data.suggested_amount}</span> : null}
            </div>
          ) : null}
        </div>

        {data.current_price != null ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-[11px] text-text-muted">PRICE</span>
            </div>
            <p className="text-2xl font-semibold text-text-primary font-mono">
              {data.current_price.toFixed(decimals)}
            </p>
            {data.price_change_pct != null ? (
              <p
                className={`mt-1 text-sm font-medium ${data.price_change_pct >= 0 ? 'text-accent-primary' : 'text-error'}`}
              >
                {data.price_change_pct >= 0 ? '+' : ''}
                {data.price_change_pct.toFixed(4)}%
              </p>
            ) : null}
          </div>
        ) : null}

        {data.trend ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-1.5">
              {data.trend === 'bullish' ? (
                <TrendingUp className="h-3.5 w-3.5 text-accent-primary" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-error" />
              )}
              <span className="text-[11px] text-text-muted">TREND</span>
            </div>
            <p
              className={`text-xl font-semibold capitalize ${data.trend === 'bullish' ? 'text-accent-primary' : 'text-error'}`}
            >
              {data.trend}
            </p>
            {data.sma_20 != null && data.sma_50 != null ? (
              <p className="mt-1 text-[11px] text-text-muted">
                SMA20 {data.sma_20 > data.sma_50 ? '>' : '<'} SMA50
              </p>
            ) : null}
            {data.volatility ? (
              <p className="mt-0.5 text-[11px] text-text-muted">Vol: {data.volatility}</p>
            ) : null}
          </div>
        ) : null}

        {data.rsi != null ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-1 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-[11px] text-text-muted">RSI (14)</span>
            </div>
            <RsiGauge value={data.rsi} />
          </div>
        ) : null}

        {data.macd ? (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-[11px] text-text-muted">MACD</span>
              <span
                className={`ml-auto text-[10px] font-semibold ${data.macd.histogram >= 0 ? 'text-accent-primary' : 'text-error'}`}
              >
                {data.macd.histogram >= 0 ? 'Bullish' : 'Bearish'}
              </span>
            </div>
            <MacdBars
              histogram={data.macd.histogram}
              macd={data.macd.macd}
              signal={data.macd.signal}
            />
          </div>
        ) : null}

        {data.bollinger && data.current_price != null ? (
          <div className="col-span-2 md:col-span-1 rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-text-muted" />
              <span className="text-[11px] text-text-muted">BOLLINGER BANDS</span>
            </div>
            <BollingerBar
              price={data.current_price}
              upper={data.bollinger.upper}
              middle={data.bollinger.middle}
              lower={data.bollinger.lower}
            />
          </div>
        ) : null}
      </div>

      <p className="mt-2 text-[10px] text-text-muted">
        Signals are AI-generated and not financial advice. Trade responsibly.
      </p>
    </div>
  );
}
