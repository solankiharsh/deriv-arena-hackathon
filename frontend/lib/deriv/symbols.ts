"use client";

import { derivWS } from "./websocket";
import { useTradeStore } from "@/lib/stores/trade-store";
import type { ActiveSymbol, ActiveSymbolsResponse } from "./types";

const ACTIVE_SYMBOL_REQUESTS = [
  { active_symbols: "full" as const },
  { active_symbols: "brief" as const, product_type: "basic" as const },
];

function normalizeSymbols(symbols: ActiveSymbol[]): ActiveSymbol[] {
  const tradable = symbols.filter(
    (symbol) => symbol.exchange_is_open === 1 && symbol.is_trading_suspended === 0
  );
  const list = tradable.length > 0 ? tradable : symbols;

  return Array.from(new Map(list.map((symbol) => [symbol.symbol, symbol])).values()).sort(
    (left, right) => {
      const marketCompare = left.market_display_name.localeCompare(right.market_display_name);
      if (marketCompare !== 0) return marketCompare;
      return left.display_name.localeCompare(right.display_name);
    }
  );
}

/**
 * Fetch active symbols from the Deriv API and populate the trade store.
 * Safe to call multiple times — it just overwrites the symbol list.
 */
export async function fetchActiveSymbols(): Promise<void> {
  try {
    let bestSymbols: ActiveSymbol[] = [];

    for (const request of ACTIVE_SYMBOL_REQUESTS) {
      const response = await derivWS.send(request);
      const data = response as unknown as ActiveSymbolsResponse;
      const normalized = normalizeSymbols(data.active_symbols ?? []);
      if (normalized.length > bestSymbols.length) {
        bestSymbols = normalized;
      }
    }

    if (bestSymbols.length === 0) {
      throw new Error("No active symbols returned");
    }

    useTradeStore.getState().setAvailableSymbols(bestSymbols);

    const currentAsset = useTradeStore.getState().selectedAsset;
    const currentExists = bestSymbols.some((symbol) => symbol.symbol === currentAsset);
    if (!currentExists) {
      useTradeStore.getState().setSelectedAsset(bestSymbols[0].symbol);
    }
  } catch {
    // Non-fatal — the user just won't see the symbol list until reconnect
  }
}
