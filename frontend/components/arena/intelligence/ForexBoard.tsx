"use client";

import { useEffect, useState } from "react";
import { CardShell } from "./CardShell";

/**
 * Forex board. Uses https://open.er-api.com (free, no key, CORS-enabled)
 * for mid-rates against USD. Values are snapshotted daily so we don't show
 * intraday deltas — just the mark.
 */
const CODES = [
  "EUR",
  "GBP",
  "JPY",
  "CHF",
  "AUD",
  "CAD",
  "SGD",
  "HKD",
  "CNY",
  "BRL",
  "INR",
  "MXN",
];

function formatRate(n: number): string {
  if (n >= 100) return n.toFixed(2);
  if (n >= 10) return n.toFixed(3);
  return n.toFixed(4);
}

export function ForexBoard() {
  const [rates, setRates] = useState<Record<string, number>>({});
  const [asOf, setAsOf] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`er-api ${res.status}`);
        const data = (await res.json()) as {
          result?: string;
          rates: Record<string, number>;
          time_last_update_utc?: string;
        };
        if (cancelled) return;
        if (data.result && data.result !== "success") {
          throw new Error("er-api returned non-success");
        }
        const next: Record<string, number> = {};
        for (const c of CODES) {
          if (data.rates[c] != null) next[c] = data.rates[c];
        }
        setRates(next);
        setAsOf(data.time_last_update_utc?.slice(5, 22) ?? null);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }
    load();
    const id = setInterval(load, 60 * 60 * 1000); // hourly; feed is daily
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <CardShell
      title="Forex Rates vs USD"
      source="open.er-api.com"
      right={
        asOf ? (
          <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">
            {asOf} UTC
          </span>
        ) : undefined
      }
    >
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {CODES.map((c) => {
          const r = rates[c];
          return (
            <div
              key={c}
              className="bg-black/20 border border-white/5 rounded px-2 py-1.5"
            >
              <div className="text-[9px] font-mono uppercase tracking-widest text-white/40">
                {c}
              </div>
              <div className="font-mono text-[12px] tabular-nums text-white/85">
                {r != null ? formatRate(r) : "—"}
              </div>
            </div>
          );
        })}
      </div>
      {error && (
        <p className="mt-2 text-[10px] text-white/30 font-mono">
          fx feed unreachable · retrying
        </p>
      )}
    </CardShell>
  );
}
