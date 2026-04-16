"use client";

import { create } from "zustand";
import type { Phantom } from "../db/schema";
import type { BehavioralProfile, ShadowPosition } from "../engines/anti-you-engine";

export type AntiYouEvolution = "SIMPLE_MIRROR" | "PATTERN_MIRROR" | "BEHAVIORAL_MIRROR" | "FULL_INVERSE";

export interface AntiYouPersonality {
  tradesPerDay: number;
  peakHours: string;
  afterLossBehavior: string;
  avgHoldDuration: number;
  favoriteAssets: string[];
  escalatesAfterLoss: boolean;
  exitsEarly: boolean;
}

export interface AntiYouWeeklyResult {
  weekStart: number;
  weekEnd: number;
  yourPnl: number;
  antiYouPnl: number;
  winner: "you" | "anti-you" | "draw";
  delta: number;
}

export interface AntiYouState {
  evolution: AntiYouEvolution;
  sessionCount: number;
  antiYouPhantoms: Phantom[];
  yourSessionPnl: number;
  antiYouSessionPnl: number;
  yourEquityCurve: Array<{ timestamp: number; value: number }>;
  antiYouEquityCurve: Array<{ timestamp: number; value: number }>;
  weeklyResults: AntiYouWeeklyResult[];
  yourPersonality: AntiYouPersonality | null;
  antiYouPersonality: AntiYouPersonality | null;
  aiInsight: string;
  yourEdges: Array<{ asset: string; yourPnl: number; antiYouPnl: number }>;
  blindSpots: Array<{ asset: string; yourPnl: number; antiYouPnl: number }>;

  // Shadow trading engine state
  shadowPositions: ShadowPosition[];
  shadowHistory: ShadowPosition[];
  profile: BehavioralProfile | null;
  shadowSessionTrades: number;
  shadowSessionWins: number;

  addAntiYouPhantom: (phantom: Phantom) => void;
  updateAntiYouPhantom: (id: string, updates: Partial<Phantom>) => void;
  updateEquityCurves: (yourPnl: number, antiYouPnl: number) => void;
  setEvolution: (evolution: AntiYouEvolution) => void;
  incrementSessionCount: () => void;
  addWeeklyResult: (result: AntiYouWeeklyResult) => void;
  setPersonalities: (yours: AntiYouPersonality, antiYou: AntiYouPersonality) => void;
  setAiInsight: (insight: string) => void;
  setEdgesAndBlindSpots: (
    edges: AntiYouState["yourEdges"],
    blindSpots: AntiYouState["blindSpots"]
  ) => void;
  setShadowPositions: (positions: ShadowPosition[]) => void;
  addShadowToHistory: (position: ShadowPosition) => void;
  setProfile: (profile: BehavioralProfile) => void;
  resetSession: () => void;
}

function getEvolutionForCount(count: number): AntiYouEvolution {
  if (count < 5) return "SIMPLE_MIRROR";
  if (count < 10) return "PATTERN_MIRROR";
  if (count < 20) return "BEHAVIORAL_MIRROR";
  return "FULL_INVERSE";
}

export const useAntiYouStore = create<AntiYouState>()((set) => ({
  evolution: "SIMPLE_MIRROR",
  sessionCount: 0,
  antiYouPhantoms: [],
  yourSessionPnl: 0,
  antiYouSessionPnl: 0,
  yourEquityCurve: [],
  antiYouEquityCurve: [],
  weeklyResults: [],
  yourPersonality: null,
  antiYouPersonality: null,
  aiInsight: "",
  yourEdges: [],
  blindSpots: [],

  shadowPositions: [],
  shadowHistory: [],
  profile: null,
  shadowSessionTrades: 0,
  shadowSessionWins: 0,

  addAntiYouPhantom: (phantom) =>
    set((state) => ({ antiYouPhantoms: [...state.antiYouPhantoms, phantom] })),

  updateAntiYouPhantom: (id, updates) =>
    set((state) => ({
      antiYouPhantoms: state.antiYouPhantoms.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  updateEquityCurves: (yourPnl, antiYouPnl) => {
    const ts = Date.now();
    set((state) => ({
      yourSessionPnl: yourPnl,
      antiYouSessionPnl: antiYouPnl,
      yourEquityCurve: [...state.yourEquityCurve, { timestamp: ts, value: yourPnl }].slice(-200),
      antiYouEquityCurve: [
        ...state.antiYouEquityCurve,
        { timestamp: ts, value: antiYouPnl },
      ].slice(-200),
    }));
  },

  setEvolution: (evolution) => set({ evolution }),

  incrementSessionCount: () =>
    set((state) => {
      const count = state.sessionCount + 1;
      return { sessionCount: count, evolution: getEvolutionForCount(count) };
    }),

  addWeeklyResult: (result) =>
    set((state) => ({ weeklyResults: [result, ...state.weeklyResults].slice(0, 52) })),

  setPersonalities: (yourPersonality, antiYouPersonality) =>
    set({ yourPersonality, antiYouPersonality }),

  setAiInsight: (aiInsight) => set({ aiInsight }),

  setEdgesAndBlindSpots: (yourEdges, blindSpots) => set({ yourEdges, blindSpots }),

  setShadowPositions: (shadowPositions) => set({ shadowPositions }),

  addShadowToHistory: (position) =>
    set((state) => ({
      shadowHistory: [position, ...state.shadowHistory].slice(0, 100),
      shadowSessionTrades: state.shadowSessionTrades + 1,
      shadowSessionWins: position.status === "won"
        ? state.shadowSessionWins + 1
        : state.shadowSessionWins,
    })),

  setProfile: (profile) => set({ profile }),

  resetSession: () =>
    set({
      antiYouPhantoms: [],
      yourSessionPnl: 0,
      antiYouSessionPnl: 0,
      shadowPositions: [],
      shadowHistory: [],
      shadowSessionTrades: 0,
      shadowSessionWins: 0,
    }),
}));
