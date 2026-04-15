"use client";

import { create } from "zustand";

export type PowerUpType = "lag_spike" | "flash_crash" | "time_warp";

export interface PowerUpDef {
  type: PowerUpType;
  label: string;
  cost: number;
  description: string;
  cooldownMs: number;
  durationMs: number;
}

export const POWER_UP_DEFS: Record<PowerUpType, PowerUpDef> = {
  lag_spike: {
    type: "lag_spike",
    label: "Lag Spike",
    cost: 2,
    description: "Freeze opponent trading for 5s",
    cooldownMs: 15_000,
    durationMs: 5_000,
  },
  flash_crash: {
    type: "flash_crash",
    label: "Flash Crash",
    cost: 3,
    description: "Inject fake wick on chart for 3s",
    cooldownMs: 15_000,
    durationMs: 3_000,
  },
  time_warp: {
    type: "time_warp",
    label: "Time Warp",
    cost: 4,
    description: "Double countdown speed for 10s",
    cooldownMs: 15_000,
    durationMs: 10_000,
  },
};

interface ActivePowerUp {
  type: PowerUpType;
  activatedAt: number;
  expiresAt: number;
}

interface PowerUpState {
  credits: number;
  activePowerUps: ActivePowerUp[];
  cooldowns: Record<PowerUpType, number>;

  addCredits: (amount: number) => void;
  activate: (type: PowerUpType) => boolean;
  tick: () => void;
  isActive: (type: PowerUpType) => boolean;
  canAfford: (type: PowerUpType) => boolean;
  isOnCooldown: (type: PowerUpType) => boolean;
  reset: () => void;
}

export const usePowerUpStore = create<PowerUpState>()((set, get) => ({
  credits: 0,
  activePowerUps: [],
  cooldowns: { lag_spike: 0, flash_crash: 0, time_warp: 0 },

  addCredits: (amount) =>
    set((state) => ({ credits: state.credits + amount })),

  activate: (type) => {
    const state = get();
    const def = POWER_UP_DEFS[type];
    const now = Date.now();

    if (state.credits < def.cost) return false;
    if (state.cooldowns[type] > now) return false;

    set((s) => ({
      credits: s.credits - def.cost,
      activePowerUps: [
        ...s.activePowerUps,
        { type, activatedAt: now, expiresAt: now + def.durationMs },
      ],
      cooldowns: { ...s.cooldowns, [type]: now + def.cooldownMs },
    }));
    return true;
  },

  tick: () => {
    const now = Date.now();
    set((state) => ({
      activePowerUps: state.activePowerUps.filter((p) => p.expiresAt > now),
    }));
  },

  isActive: (type) => {
    const now = Date.now();
    return get().activePowerUps.some((p) => p.type === type && p.expiresAt > now);
  },

  canAfford: (type) => get().credits >= POWER_UP_DEFS[type].cost,

  isOnCooldown: (type) => get().cooldowns[type] > Date.now(),

  reset: () =>
    set({
      credits: 0,
      activePowerUps: [],
      cooldowns: { lag_spike: 0, flash_crash: 0, time_warp: 0 },
    }),
}));
