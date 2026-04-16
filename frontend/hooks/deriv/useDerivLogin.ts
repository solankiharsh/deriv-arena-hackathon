"use client";

import { useCallback } from "react";
import { derivWS } from "@/lib/deriv/websocket";
import { useAuthStore } from "@/lib/stores/auth-store";
import { storeToken, validateTokenFormat } from "@/lib/deriv/auth";
import { fetchActiveSymbols } from "@/lib/deriv/symbols";
import { seedAndHydrate } from "@/lib/seed/hydrate-stores";
import type { AuthorizeResponse, BalanceResponse } from "@/lib/deriv/types";

/**
 * Lightweight hook that exposes only login/logout actions.
 * Does NOT trigger the auto-connect/init side-effect — use this in the
 * LoginPage so it never interferes with the AppShell's connection lifecycle.
 */
export function useDerivLogin() {
  const {
    appId,
    setToken,
    setAccountInfo,
    setAuthorized,
    setBalance,
    setConnected,
    setConnecting,
    setError,
    setDemoMode,
    logout: storeLogout,
  } = useAuthStore();

  const login = useCallback(
    async (token: string): Promise<boolean> => {
      if (!validateTokenFormat(token)) {
        setError("Invalid token format");
        return false;
      }

      setConnecting(true);
      setError(null);

      try {
        setDemoMode(false);
        if (!derivWS.connected) {
          derivWS.connect(appId);
          await new Promise<void>((resolve) => {
            const unsub = derivWS.onConnectionChange((c) => {
              if (c) { unsub(); resolve(); }
            });
            setTimeout(() => { unsub(); resolve(); }, 8000);
          });
        }

        const response = await derivWS.authorize(token);
        const authResponse = response as unknown as AuthorizeResponse;

        if (authResponse.authorize) {
          setToken(token);
          setAccountInfo(authResponse.authorize);
          setAuthorized(true);
          await storeToken(token);

          await derivWS.subscribe(
            { balance: 1, subscribe: 1 },
            (data) => {
              const balData = data as unknown as BalanceResponse;
              if (balData.balance) setBalance(balData.balance.balance);
            }
          );

          fetchActiveSymbols();
          seedAndHydrate();

          return true;
        }

        setError("Authorization failed — check your token and App ID.");
        return false;
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "message" in err
            ? (err as { message: string }).message
            : "Connection error";
        setError(msg);
        return false;
      } finally {
        setConnecting(false);
      }
    },
    [appId, setToken, setAccountInfo, setAuthorized, setBalance, setConnected, setConnecting, setDemoMode, setError]
  );

  const loginDemo = useCallback(async (): Promise<boolean> => {
    setConnecting(true);
    setError(null);
    setDemoMode(true);
    setToken(null);
    setAuthorized(true);

    try {
      if (!derivWS.connected) {
        derivWS.connect(appId);
        await new Promise<void>((resolve) => {
          const unsub = derivWS.onConnectionChange((c) => {
            if (c) { unsub(); resolve(); }
          });
          setTimeout(() => { unsub(); resolve(); }, 8000);
        });
      }

      setConnected(derivWS.connected);
      fetchActiveSymbols();
      seedAndHydrate();
      return true;
    } catch {
      // Demo mode remains usable with seeded data even if the socket cannot connect.
      setConnected(false);
      seedAndHydrate();
      return true;
    } finally {
      setConnecting(false);
    }
  }, [appId, setAuthorized, setConnected, setConnecting, setDemoMode, setError, setToken]);

  const logout = useCallback(() => {
    derivWS.disconnect();
    storeLogout();
    import("@/lib/deriv/auth").then(({ clearToken }) => clearToken());
  }, [storeLogout]);

  return { login, loginDemo, logout };
}
