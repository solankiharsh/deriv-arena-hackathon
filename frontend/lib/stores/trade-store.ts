"use client";

import { create } from "zustand";
import type { Trade } from "../db/schema";
import type { ActiveSymbol } from "../deriv/types";

interface ActivePosition {
  contractId: number;
  asset: string;
  direction: "CALL" | "PUT";
  stake: number;
  payout: number;
  entrySpot: number;
  currentSpot: number;
  currentPnl: number;
  startTime: number;
  expiryTime: number;
  status: "open" | "won" | "lost" | "sold";
}

interface TradeState {
  activePosition: ActivePosition | null;
  tradeHistory: Trade[];
  sessionPnl: number;
  sessionTrades: number;
  sessionWins: number;
  winStreak: number;
  lossStreak: number;
  availableSymbols: ActiveSymbol[];
  selectedAsset: string;
  selectedDirection: "CALL" | "PUT";
  selectedStake: number;
  selectedDuration: number;
  selectedDurationUnit: string;

  setActivePosition: (position: ActivePosition | null) => void;
  updateActivePosition: (updates: Partial<ActivePosition>) => void;
  addTrade: (trade: Trade) => void;
  updateTrade: (id: string, updates: Partial<Trade>) => void;
  setTradeHistory: (trades: Trade[]) => void;
  setAvailableSymbols: (symbols: ActiveSymbol[]) => void;
  setSelectedAsset: (asset: string) => void;
  setSelectedDirection: (direction: "CALL" | "PUT") => void;
  setSelectedStake: (stake: number) => void;
  setSelectedDuration: (duration: number) => void;
  setSelectedDurationUnit: (unit: string) => void;
  recordTradeResult: (win: boolean, pnl: number) => void;
  resetSession: () => void;
}

export const useTradeStore = create<TradeState>()((set) => ({
  activePosition: null,
  tradeHistory: [],
  sessionPnl: 0,
  sessionTrades: 0,
  sessionWins: 0,
  winStreak: 0,
  lossStreak: 0,
  availableSymbols: [],
  selectedAsset: "R_100",
  selectedDirection: "CALL",
  selectedStake: 10,
  selectedDuration: 5,
  selectedDurationUnit: "m",

  setActivePosition: (activePosition) => set({ activePosition }),

  updateActivePosition: (updates) =>
    set((state) => ({
      activePosition: state.activePosition
        ? { ...state.activePosition, ...updates }
        : null,
    })),

  addTrade: (trade) =>
    set((state) => ({ tradeHistory: [trade, ...state.tradeHistory] })),

  updateTrade: (id, updates) =>
    set((state) => ({
      tradeHistory: state.tradeHistory.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),

  setTradeHistory: (tradeHistory) => set({ tradeHistory }),

  setAvailableSymbols: (availableSymbols) => set({ availableSymbols }),

  setSelectedAsset: (selectedAsset) => set({ selectedAsset }),

  setSelectedDirection: (selectedDirection) => set({ selectedDirection }),

  setSelectedStake: (selectedStake) => set({ selectedStake }),

  setSelectedDuration: (selectedDuration) => set({ selectedDuration }),

  setSelectedDurationUnit: (selectedDurationUnit) => set({ selectedDurationUnit }),

  recordTradeResult: (win, pnl) =>
    set((state) => ({
      sessionPnl: state.sessionPnl + pnl,
      sessionTrades: state.sessionTrades + 1,
      sessionWins: win ? state.sessionWins + 1 : state.sessionWins,
      winStreak: win ? state.winStreak + 1 : 0,
      lossStreak: win ? 0 : state.lossStreak + 1,
    })),

  resetSession: () =>
    set({
      sessionPnl: 0,
      sessionTrades: 0,
      sessionWins: 0,
      winStreak: 0,
      lossStreak: 0,
      activePosition: null,
    }),
}));
