"use client";

import { create } from "zustand";
import type { AuthorizeResponse } from "../deriv/types";

interface AuthState {
  token: string | null;
  appId: string;
  accountInfo: AuthorizeResponse["authorize"] | null;
  isDemoMode: boolean;
  // Provider/account balance from Deriv. Game/session balance should be derived separately.
  balance: number;
  currency: string;
  isConnected: boolean;
  isAuthorized: boolean;
  isConnecting: boolean;
  error: string | null;

  setToken: (token: string | null) => void;
  setAppId: (appId: string) => void;
  setAccountInfo: (info: AuthorizeResponse["authorize"]) => void;
  setBalance: (balance: number) => void;
  setConnected: (connected: boolean) => void;
  setAuthorized: (authorized: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  setDemoMode: (isDemoMode: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  appId: process.env.NEXT_PUBLIC_DERIV_APP_ID || "1089",
  accountInfo: null,
  isDemoMode: true,
  balance: 10000,
  currency: "USD",
  isConnected: false,
  isAuthorized: false,
  isConnecting: false,
  error: null,

  setToken: (token) => set({ token }),
  setAppId: (appId) => set({ appId }),
  setAccountInfo: (accountInfo) =>
    set({ accountInfo, currency: accountInfo.currency }),
  setBalance: (balance) => set({ balance }),
  setConnected: (isConnected) => set({ isConnected }),
  setAuthorized: (isAuthorized) => set({ isAuthorized }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  setError: (error) => set({ error }),
  setDemoMode: (isDemoMode) => set({ isDemoMode }),
  logout: () =>
    set({
      token: null,
      accountInfo: null,
      isDemoMode: false,
      balance: 0,
      isAuthorized: false,
      error: null,
    }),
}));
