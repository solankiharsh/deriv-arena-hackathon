"use client";

import { useEffect, useRef, useState } from "react";
import { CardShell, Delta } from "./CardShell";

/**
 * CoinGecko public `/simple/price` endpoint.
 * - No API key, no CORS pain for read-only client-side.
 * - Pulled every 30s to respect their generous-but-not-infinite free tier.
 */
interface CoinRow {
  id: string; // CoinGecko id
  symbol: string; // display ticker
  name: string;
}

const COINS: CoinRow[] = [
  { id: "bitcoin",   symbol: "BTC",  name: "Bitcoin" },
  { id: "ethereum",  symbol: "ETH",  name: "Ethereum" },
  { id: "ripple",    symbol: "XRP",  name: "XRP" },
  { id: "binancecoin", symbol: "BNB", name: "BNB" },
  { id: "solana",    symbol: "SOL",  name: "Solana" },
  { id: "dogecoin",  symbol: "DOGE", name: "Dogecoin" },
  { id: "cardano",   symbol: "ADA",  name: "Cardano" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
];

interface CoinQuote {
  price: number;
  change24h: number;
}

function formatPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(5)}`;
}

export function CryptoMarkets() {
  const [quotes, setQuotes] = useState<Record<string, CoinQuote>>({});
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const ids = COINS.map((c) => c.id).join(",");
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
        const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        if (!res.ok) throw new Error(`coingecko ${res.status}`);
        const data = (await res.json()) as Record<
          string,
          { usd: number; usd_24h_change?: number }
        >;
        if (cancelled) return;

        const next: Record<string, CoinQuote> = {};
        for (const c of COINS) {
          const q = data[c.id];
          if (q) {
            next[c.id] = {
              price: q.usd,
              change24h: q.usd_24h_change ?? 0,
            };
          }
        }
        setQuotes(next);
        setError(null);
      } catch (err) {
        if (cancelled || (err as Error).name === "AbortError") return;
        setError((err as Error).message);
      }
    }

    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, []);

  return (
    <CardShell title="Crypto Markets" source="CoinGecko">
      <div className="divide-y divide-white/5">
        {COINS.map((c) => {
          const q = quotes[c.id];
          return (
            <div
              key={c.id}
              className="flex items-center justify-between py-1.5 px-1"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-mono font-semibold text-white/80">
                  {c.symbol}
                </div>
                <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider">
                  {c.name}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="font-mono text-[12px] tabular-nums text-white/90">
                  {q ? formatPrice(q.price) : "—"}
                </span>
                <Delta value={q?.change24h ?? null} />
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-2 text-[10px] text-white/30 font-mono">
          coingecko rate-limit · retrying
        </p>
      )}
    </CardShell>
  );
}
