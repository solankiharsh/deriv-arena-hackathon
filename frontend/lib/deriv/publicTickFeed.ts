'use strict';

/** Deriv public options WebSocket (ticks + optional history seed). */
export const DERIV_PUBLIC_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

const MAX_RETURNS_BUFFER = 160;

export function returnsFromPrices(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const a = prices[i - 1]!;
    const b = prices[i]!;
    if (a === 0 || !Number.isFinite(a) || !Number.isFinite(b)) continue;
    out.push((b - a) / a);
  }
  return out;
}

export type DerivFeedStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export interface DerivTickPayload {
  quote: number;
  symbol: string;
}

export interface CreateDerivPublicTickFeedOptions {
  symbol: string;
  historyCount?: number;
  onTick: (p: DerivTickPayload) => void;
  onHistoryReturns?: (returns: number[], lastQuote: number) => void;
  onStatus?: (s: DerivFeedStatus, detail?: string) => void;
}

/**
 * Browser WebSocket to Deriv public API. Call `dispose()` on unmount or symbol change.
 */
export function createDerivPublicTickFeed(opts: CreateDerivPublicTickFeedOptions): { dispose: () => void } {
  const { symbol, onTick, onHistoryReturns, onStatus } = opts;
  const historyCount = Math.min(120, Math.max(10, opts.historyCount ?? 40));

  if (typeof WebSocket === 'undefined') {
    onStatus?.('error', 'WebSocket not available');
    return { dispose: () => {} };
  }

  let ws: WebSocket | null = null;
  let disposed = false;
  let reqId = 1;

  const send = (msg: Record<string, unknown>) => {
    if (disposed || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ ...msg, req_id: reqId++ }));
  };

  const handleMessage = (raw: string) => {
    let d: Record<string, unknown>;
    try {
      d = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return;
    }
    if (d.error) {
      const err = d.error as { message?: string };
      onStatus?.('error', err?.message ?? 'deriv error');
      return;
    }

    if (d.msg_type === 'history') {
      const h = d.history as { prices?: unknown } | undefined;
      const rawPrices = h?.prices;
      if (!Array.isArray(rawPrices) || rawPrices.length < 2) return;
      const prices = rawPrices.map((x) => Number(x)).filter((n) => Number.isFinite(n));
      if (prices.length < 2) return;
      const rs = returnsFromPrices(prices).slice(-MAX_RETURNS_BUFFER);
      const lastQuote = prices[prices.length - 1]!;
      onHistoryReturns?.(rs, lastQuote);
    }

    const tick = d.tick as { quote?: unknown; symbol?: unknown } | undefined;
    if (d.msg_type === 'tick' && tick && tick.quote != null) {
      const q = Number(tick.quote);
      if (!Number.isFinite(q) || q <= 0) return;
      const sym = typeof tick.symbol === 'string' ? tick.symbol : symbol;
      onTick({ quote: q, symbol: sym });
    }
  };

  const connect = () => {
    onStatus?.('connecting');
    ws = new WebSocket(DERIV_PUBLIC_WS_URL);
    ws.onopen = () => {
      if (disposed) return;
      onStatus?.('open');
      send({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: historyCount,
        end: 'latest',
        style: 'ticks',
      });
      send({ ticks: symbol, subscribe: 1 });
    };
    ws.onmessage = (ev) => handleMessage(String(ev.data));
    ws.onerror = () => {
      if (!disposed) onStatus?.('error', 'socket error');
    };
    ws.onclose = () => {
      if (!disposed) onStatus?.('closed');
    };
  };

  connect();

  return {
    dispose: () => {
      disposed = true;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = null;
    },
  };
}
