"use client";

import { create } from "zustand";
import type { TiltZone } from "../db/schema";
import { scoreToZone } from "../engines/tilt-detection";

interface TiltState {
  score: number;
  zone: TiltZone;
  history: Array<{ timestamp: number; score: number; zone: TiltZone }>;
  interventionActive: boolean;
  interventionType: "premortem" | "lockout" | null;
  lockedUntil: number | null;
  premortemText: string;
  consecutiveLosses: number;
  lastTradeTimestamp: number | null;
  lastLossTimestamp: number | null;

  setScore: (score: number) => void;
  setZone: (zone: TiltZone) => void;
  addHistory: (entry: { timestamp: number; score: number; zone: TiltZone }) => void;
  setInterventionActive: (active: boolean, type?: "premortem" | "lockout" | null) => void;
  setLockedUntil: (until: number | null) => void;
  setPremortemText: (text: string) => void;
  setConsecutiveLosses: (count: number) => void;
  setLastTradeTimestamp: (ts: number | null) => void;
  setLastLossTimestamp: (ts: number | null) => void;
  reset: () => void;
}

export const useTiltStore = create<TiltState>()((set) => ({
  score: 0,
  zone: "COMPOSED",
  history: [],
  interventionActive: false,
  interventionType: null,
  lockedUntil: null,
  premortemText: "",
  consecutiveLosses: 0,
  lastTradeTimestamp: null,
  lastLossTimestamp: null,

  setScore: (score) => {
    const clamped = Math.max(0, Math.min(100, score));
    set({ score: clamped, zone: scoreToZone(clamped) });
  },

  setZone: (zone) => set({ zone }),

  addHistory: (entry) =>
    set((state) => ({
      history: [entry, ...state.history].slice(0, 200),
    })),

  setInterventionActive: (active, type = null) =>
    set({ interventionActive: active, interventionType: active ? type : null }),

  setLockedUntil: (lockedUntil) => set({ lockedUntil }),

  setPremortemText: (premortemText) => set({ premortemText }),

  setConsecutiveLosses: (consecutiveLosses) => set({ consecutiveLosses }),

  setLastTradeTimestamp: (lastTradeTimestamp) => set({ lastTradeTimestamp }),

  setLastLossTimestamp: (lastLossTimestamp) => set({ lastLossTimestamp }),

  reset: () =>
    set({
      score: 0,
      zone: "COMPOSED",
      history: [],
      interventionActive: false,
      interventionType: null,
      lockedUntil: null,
      premortemText: "",
      consecutiveLosses: 0,
      lastTradeTimestamp: null,
      lastLossTimestamp: null,
    }),
}));
