"use client";

import { useEffect, useRef } from "react";
import { derivWS } from "@/lib/deriv/websocket";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchActiveSymbols } from "@/lib/deriv/symbols";
import { seedAndHydrate } from "@/lib/seed/hydrate-stores";

export function DerivAutoConnect() {
  const started = useRef(false);
  const { appId, setConnected, setAuthorized, isConnected } = useAuthStore();

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

    derivWS.connect(appId);

    const waitForConnection = () =>
      new Promise<void>((resolve) => {
        if (derivWS.connected) {
          resolve();
          return;
        }
        const unsub = derivWS.onConnectionChange((c) => {
          if (c) {
            unsub();
            resolve();
          }
        });
        setTimeout(() => {
          unsub();
          resolve();
        }, 8000);
      });

    waitForConnection().then(() => {
      if (derivWS.connected) {
        setConnected(true);
        setAuthorized(true);
        fetchActiveSymbols();
        seedAndHydrate();
      }
    });
  }, [appId, isConnected, setConnected, setAuthorized]);

  return null;
}
