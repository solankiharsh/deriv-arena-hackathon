"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { subscribeTicks, type TickEvent } from "@/lib/deriv/tick-bus";
import { derivWS } from "@/lib/deriv/websocket";
import { CardShell, Delta } from "./CardShell";

/**
 * Streams public Deriv ticks for the headline accumulator / multipliers /
 * boom-crash symbols (the same ticker strip you see at the bottom of the
 * Arena pages). Each row is a live best-bid price + intraday delta anchored
 * to the first tick we observe after mount.
 *
 * Only "public" data — no OAuth needed.
 */
interface SymbolRow {
  symbol: string;
  label: string;
  family: "volatility" | "boom_crash" | "crypto" | "forex";
}

const SYMBOLS: SymbolRow[] = [
  { symbol: "R_100", label: "VOL 100", family: "volatility" },
  { symbol: "R_75", label: "VOL 75", family: "volatility" },
  { symbol: "R_50", label: "VOL 50", family: "volatility" },
  { symbol: "BOOM500", label: "BOOM 500", family: "boom_crash" },
  { symbol: "CRASH500", label: "CRASH 500", family: "boom_crash" },
  { symbol: "stpRNG", label: "STEP", family: "volatility" },
  { symbol: "cryBTCUSD", label: "BTC/USD", family: "crypto" },
  { symbol: "frxEURUSD", label: "EUR/USD", family: "forex" },
];

interface PriceState {
  price: number | null;
  anchor: number | null;
  epoch: number | null;
}

function initialState(): Record<string, PriceState> {
  const out: Record<string, PriceState> = {};
  for (const s of SYMBOLS) {
    out[s.symbol] = { price: null, anchor: null, epoch: null };
  }
  return out;
}

export function DerivLiveMarkets() {
  const [prices, setPrices] = useState<Record<string, PriceState>>(initialState);
  const pricesRef = useRef(prices);
  const [connected, setConnected] = useState(derivWS.connected);

  // Ensure the singleton WS is connected. `connect` is idempotent on this
  // manager so calling it again from multiple cards is safe.
  useEffect(() => {
    const appId =
      process.env.NEXT_PUBLIC_DERIV_LEGACY_WS_APP_ID ||
      process.env.NEXT_PUBLIC_DERIV_APP_ID ||
      "";
    if (!derivWS.connected && appId) {
      derivWS.connect(appId);
    }

    const unsub = derivWS.onStatusChange((status) => {
      setConnected(status.connected);
    });
    return unsub;
  }, []);

  // Subscribe to each symbol through the shared tick bus. Unsubs on unmount.
  useEffect(() => {
    const unsubs = SYMBOLS.map((s) =>
      subscribeTicks(s.symbol, (tick: TickEvent) => {
        pricesRef.current = {
          ...pricesRef.current,
          [s.symbol]: {
            price: tick.quote,
            anchor: pricesRef.current[s.symbol]?.anchor ?? tick.quote,
            epoch: tick.epoch,
          },
        };
        setPrices(pricesRef.current);
      }),
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, []);

  const rows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const p = prices[s.symbol];
      const delta =
        p?.price != null && p.anchor != null && p.anchor !== 0
          ? ((p.price - p.anchor) / p.anchor) * 100
          : null;
      return { ...s, state: p, delta };
    });
  }, [prices]);

  return (
    <CardShell
      title="Deriv Live Markets"
      source="Deriv WS"
      right={
        <span
          className={`flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider ${
            connected ? "text-green-400" : "text-white/30"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-green-400 animate-pulse" : "bg-white/20"
            }`}
          />
          {connected ? "STREAM" : "IDLE"}
        </span>
      }
    >
      <div className="divide-y divide-white/5">
        {rows.map((r) => (
          <div
            key={r.symbol}
            className="flex items-center justify-between py-1.5 px-1"
          >
            <div className="min-w-0">
              <div className="text-[11px] font-mono font-semibold text-white/80 truncate">
                {r.label}
              </div>
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-wider">
                {r.symbol}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="font-mono text-[12px] tabular-nums text-white/90">
                {r.state?.price != null
                  ? r.state.price.toLocaleString(undefined, {
                      maximumFractionDigits: 5,
                    })
                  : "—"}
              </span>
              <Delta value={r.delta} />
            </div>
          </div>
        ))}
      </div>
      {!connected && (
        <p className="mt-2 text-[10px] text-white/30 font-mono">
          Waiting for Deriv stream. If you just signed in, ticks arrive in ~1–2s.
        </p>
      )}
    </CardShell>
  );
}
