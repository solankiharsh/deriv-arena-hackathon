'use strict';

/**
 * Smoke: Deriv public WS → ticks_history → runSwarm → stdout (exit 0/1).
 *
 * Env:
 * - `PAPER_SYMBOL` — Deriv underlying (default `1HZ100V`).
 * - `MARKETDATA_*` / `MARKETDATA_ENABLED` — used by Go collector when running the backend (see server main).
 * - OAuth (`DERIV_APP_ID`, callback routes) — deferred; see `lib/auth/oauthDeferred.ts`.
 */

import { DEFAULT_KNOBS, runSwarm } from '../lib/agents';
import type { MarketContext } from '../lib/agents/types';

const symbol = (process.env.PAPER_SYMBOL || '1HZ100V').replace(/[^\w]/g, '').slice(0, 24) || '1HZ100V';
const url = 'wss://api.derivws.com/trading/v1/options/ws/public';

function parseHistoryPrices(raw: unknown): number[] | null {
  if (!raw || typeof raw !== 'object') return null;
  const h = (raw as { history?: { prices?: unknown } }).history;
  const prices = h?.prices;
  if (!Array.isArray(prices) || prices.length < 2) return null;
  const nums = prices.map((p) => Number(p)).filter((n) => Number.isFinite(n));
  return nums.length >= 2 ? nums : null;
}

const ws = new WebSocket(url);

const fail = (msg: string): never => {
  console.error(msg);
  try {
    ws.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
};

ws.addEventListener('open', () => {
  ws.send(
    JSON.stringify({
      ticks_history: symbol,
      adjust_start_time: 1,
      count: 20,
      end: 'latest',
      style: 'ticks',
      req_id: 1,
    }),
  );
});

ws.addEventListener('message', (ev) => {
  let d: Record<string, unknown>;
  try {
    d = JSON.parse(String(ev.data)) as Record<string, unknown>;
  } catch {
    return;
  }
  if (d.error) {
    const err = d.error as { code?: string; message?: string };
    fail(`WS error ${err.code ?? '?'}: ${err.message ?? ''}`);
  }
  if (d.msg_type !== 'history') return;

  const pricesParsed = parseHistoryPrices(d);
  if (!pricesParsed) {
    console.error('No history.prices from Deriv');
    try {
      ws.close();
    } catch {
      /* ignore */
    }
    process.exit(1);
  }
  const prices = pricesParsed;

  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!;
    const cur = prices[i]!;
    if (prev === 0) continue;
    returns.push((cur - prev) / prev);
  }
  const lastQuote = prices[prices.length - 1]!;
  const ctx: MarketContext = {
    symbol,
    lastQuote,
    returns,
    sentimentPlaceholder: 0,
  };

  const out = runSwarm(ctx, DEFAULT_KNOBS);
  console.log(JSON.stringify({ symbol, lastQuote, fused: out.fused, analyzerIds: out.analyzers.map((a) => a.id) }, null, 2));
  ws.close();
  process.exit(0);
});

ws.addEventListener('error', () => fail('WebSocket error'));
setTimeout(() => fail('Timed out waiting for history'), 18000);
