"use client";

import { create } from "zustand";
import type { ArenaEvent } from "../db/schema";

export type FighterAction = "idle" | "jab" | "hook" | "block" | "hit" | "ko" | "uppercut" | "body-blow" | "stagger" | "dodge";

const FIGHT_ANIM_MS = 700;

interface ArenaState {
  yourHealth: number;
  antiYouHealth: number;
  round: number;
  score: number;
  recentEvents: ArenaEvent[];
  activeEvent: ArenaEvent | null;
  isShaking: boolean;
  comboCount: number;
  sessionResult: "win" | "loss" | "draw" | null;

  yourAction: FighterAction;
  antiYouAction: FighterAction;
  sessionRecord: { wins: number; losses: number; draws: number };

  damageLevel: number;
  heatModeActive: boolean;
  heatModeStartedAt: number | null;
  knockoutProgress: number;
  shakeIntensity: number;

  setYourHealth: (health: number) => void;
  setAntiYouHealth: (health: number) => void;
  adjustYourHealth: (delta: number) => void;
  adjustAntiYouHealth: (delta: number) => void;
  incrementRound: () => void;
  addEvent: (event: ArenaEvent) => void;
  setActiveEvent: (event: ArenaEvent | null) => void;
  triggerShake: (intensity?: number) => void;
  incrementCombo: () => void;
  resetCombo: () => void;
  setSessionResult: (result: "win" | "loss" | "draw" | null) => void;
  triggerFight: (yourAction: FighterAction, antiYouAction: FighterAction) => void;
  setDamageLevel: (level: number) => void;
  setHeatMode: (active: boolean) => void;
  setKnockoutProgress: (progress: number) => void;
  resetArena: () => void;
}

let fightTimer: ReturnType<typeof setTimeout> | null = null;

export const useArenaStore = create<ArenaState>()((set) => ({
  yourHealth: 100,
  antiYouHealth: 100,
  round: 1,
  score: 0,
  recentEvents: [],
  activeEvent: null,
  isShaking: false,
  comboCount: 0,
  sessionResult: null,
  yourAction: "idle",
  antiYouAction: "idle",
  sessionRecord: { wins: 0, losses: 0, draws: 0 },
  damageLevel: 0,
  heatModeActive: false,
  heatModeStartedAt: null,
  knockoutProgress: 0,
  shakeIntensity: 1,

  setYourHealth: (yourHealth) =>
    set({ yourHealth: Math.max(0, Math.min(100, yourHealth)) }),

  setAntiYouHealth: (antiYouHealth) =>
    set({ antiYouHealth: Math.max(0, Math.min(100, antiYouHealth)) }),

  adjustYourHealth: (delta) =>
    set((state) => ({
      yourHealth: Math.max(0, Math.min(100, state.yourHealth + delta)),
    })),

  adjustAntiYouHealth: (delta) =>
    set((state) => ({
      antiYouHealth: Math.max(0, Math.min(100, state.antiYouHealth + delta)),
    })),

  incrementRound: () => set((state) => ({ round: state.round + 1 })),

  addEvent: (event) =>
    set((state) => ({
      recentEvents: [event, ...state.recentEvents].slice(0, 20),
      activeEvent: event,
    })),

  setActiveEvent: (activeEvent) => set({ activeEvent }),

  triggerShake: (intensity = 1) => {
    set({ isShaking: true, shakeIntensity: intensity });
    setTimeout(() => set({ isShaking: false, shakeIntensity: 1 }), 600);
  },

  incrementCombo: () =>
    set((state) => ({ comboCount: state.comboCount + 1 })),

  resetCombo: () => set({ comboCount: 0 }),

  setSessionResult: (sessionResult) =>
    set((state) => {
      if (!sessionResult) return { sessionResult };
      const rec = { ...state.sessionRecord };
      if (sessionResult === "win") rec.wins++;
      else if (sessionResult === "loss") rec.losses++;
      else rec.draws++;
      return { sessionResult, sessionRecord: rec };
    }),

  triggerFight: (yourAction, antiYouAction) => {
    if (fightTimer) clearTimeout(fightTimer);
    set({ yourAction, antiYouAction });
    fightTimer = setTimeout(() => {
      set({ yourAction: "idle", antiYouAction: "idle" });
      fightTimer = null;
    }, FIGHT_ANIM_MS);
  },

  setDamageLevel: (damageLevel) => set({ damageLevel }),

  setHeatMode: (active) =>
    set({ heatModeActive: active, heatModeStartedAt: active ? Date.now() : null }),

  setKnockoutProgress: (knockoutProgress) =>
    set({ knockoutProgress: Math.max(0, Math.min(100, knockoutProgress)) }),

  resetArena: () =>
    set({
      yourHealth: 100,
      antiYouHealth: 100,
      round: 1,
      score: 0,
      recentEvents: [],
      activeEvent: null,
      isShaking: false,
      comboCount: 0,
      sessionResult: null,
      yourAction: "idle",
      antiYouAction: "idle",
      damageLevel: 0,
      heatModeActive: false,
      heatModeStartedAt: null,
      knockoutProgress: 0,
      shakeIntensity: 1,
    }),
}));
