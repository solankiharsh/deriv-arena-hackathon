"use client";

import { useEffect, useRef } from "react";
import { derivWS } from "@/lib/deriv/websocket";
import { derivTradingWS } from "@/lib/deriv/trading-ws";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { fetchActiveSymbols } from "@/lib/deriv/symbols";
import { seedAndHydrate } from "@/lib/seed/hydrate-stores";

export function DerivAutoConnect() {
  const started = useRef(false);
  const {
    appId,
    setConnected,
    setAuthorized,
    setBalance,
    setDemoMode,
    isConnected,
  } = useAuthStore();
  const setRealTradeMode = useTradeStore((s) => s.setRealTradeMode);

  useEffect(() => {
    const unsub = derivWS.onConnectionChange((connected) => {
      setConnected(connected);
      if (!connected) setAuthorized(false);
    });
    return unsub;
  }, [setConnected, setAuthorized]);

  useEffect(() => {
    if (started.current || isConnected) return;
    started.current = true;

    const init = async () => {
      derivWS.connect(appId);
      await waitForConnection();
      if (derivWS.connected) {
        setConnected(true);
      }

      const tradingConnected = await derivTradingWS.connect();

      if (tradingConnected) {
        setAuthorized(true);
        setDemoMode(true);
        setRealTradeMode(true);

        derivTradingWS.subscribeBalance((balance) => {
          setBalance(balance);
        });
      } else {
        setRealTradeMode(false);
      }

      fetchActiveSymbols();
      seedAndHydrate();
    };

    init();
  }, [appId, isConnected, setConnected, setAuthorized, setBalance, setDemoMode, setRealTradeMode]);

  return null;
}

function waitForConnection(timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (derivWS.connected) {
      resolve(true);
      return;
    }
    const unsub = derivWS.onConnectionChange((c) => {
      if (c) {
        unsub();
        resolve(true);
      }
    });
    setTimeout(() => {
      unsub();
      resolve(false);
    }, timeoutMs);
  });
}
