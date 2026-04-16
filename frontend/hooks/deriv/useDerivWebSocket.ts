"use client";

import { useEffect } from "react";
import { derivWS } from "@/lib/deriv/websocket";
import { useAuthStore } from "@/lib/stores/auth-store";
import { retrieveToken } from "@/lib/deriv/auth";
import { fetchActiveSymbols } from "@/lib/deriv/symbols";
import { seedAndHydrate } from "@/lib/seed/hydrate-stores";
import type { AuthorizeResponse, BalanceResponse } from "@/lib/deriv/types";

/**
 * Manages the Deriv WebSocket lifecycle (connect, auth, balance subscription).
 * Called once in AppShell — handles auto-reconnect from a persisted token.
 * Does NOT expose login/logout; those live in useDerivLogin.
 */
export function useDerivWebSocket() {
  const {
    setConnected,
    setAuthorized,
    setConnecting,
    setError,
    setAccountInfo,
    setBalance,
    setToken,
    appId,
    isDemoMode,
  } = useAuthStore();

  useEffect(() => {
    const removeListener = derivWS.onConnectionChange((connected) => {
      setConnected(connected);
      if (!connected) setAuthorized(false);
    });
    return removeListener;
  }, [setConnected, setAuthorized]);

  useEffect(() => {
    const init = async () => {
      setConnecting(true);
      try {
        const savedToken = await retrieveToken();
        if (savedToken) {
          setToken(savedToken);
          derivWS.connect(appId);

          await new Promise<void>((resolve) => {
            if (derivWS.connected) { resolve(); return; }
            const unsub = derivWS.onConnectionChange((c) => {
              if (c) { unsub(); resolve(); }
            });
            setTimeout(() => { unsub(); resolve(); }, 5000);
          });

          if (derivWS.connected) {
            const response = await derivWS.authorize(savedToken);
            const authResponse = response as unknown as AuthorizeResponse;
            if (authResponse.authorize) {
              setAccountInfo(authResponse.authorize);
              setAuthorized(true);

              await derivWS.subscribe(
                { balance: 1, subscribe: 1 },
                (data) => {
                  const balData = data as unknown as BalanceResponse;
                  if (balData.balance) setBalance(balData.balance.balance);
                }
              );

              fetchActiveSymbols();
              seedAndHydrate();
            }
          }
        } else if (isDemoMode) {
          derivWS.connect(appId);

          await new Promise<void>((resolve) => {
            if (derivWS.connected) { resolve(); return; }
            const unsub = derivWS.onConnectionChange((c) => {
              if (c) { unsub(); resolve(); }
            });
            setTimeout(() => { unsub(); resolve(); }, 5000);
          });

          setAuthorized(true);
          fetchActiveSymbols();
          seedAndHydrate();
        }
      } catch {
        setError("Connection failed");
      } finally {
        setConnecting(false);
      }
    };

    init();
  }, [appId, isDemoMode, setAccountInfo, setAuthorized, setBalance, setConnecting, setError, setToken]);
}
