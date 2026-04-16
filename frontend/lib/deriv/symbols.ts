"use client";

import { derivWS } from "./websocket";
import { useTradeStore } from "@/lib/stores/trade-store";
import type { ActiveSymbolsResponse } from "./types";

/**
 * Fetch active symbols from the Deriv API and populate the trade store.
 * Safe to call multiple times — it just overwrites the symbol list.
 */
export async function fetchActiveSymbols(): Promise<void> {
  try {
    const response = await derivWS.send({ active_symbols: "brief", product_type: "basic" });
    const data = response as unknown as ActiveSymbolsResponse;

    if (data.active_symbols?.length) {
      const open = data.active_symbols.filter(
        (s) => s.exchange_is_open === 1 && s.is_trading_suspended === 0
      );

      const symbols = open.length > 0 ? open : data.active_symbols;
      useTradeStore.getState().setAvailableSymbols(symbols);

      const currentAsset = useTradeStore.getState().selectedAsset;
      const currentExists = symbols.some((s) => s.symbol === currentAsset);
      if (!currentExists && symbols.length > 0) {
        useTradeStore.getState().setSelectedAsset(symbols[0].symbol);
      }
    }
  } catch {
    // Non-fatal — the user just won't see the symbol list until reconnect
  }
}
