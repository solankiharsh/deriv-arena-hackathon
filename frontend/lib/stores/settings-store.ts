"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  // Arena settings
  arenaAnimationsEnabled: boolean;
  arenaScreenShakeEnabled: boolean;
  arenaSoundEnabled: boolean;
  arenaSize: "compact" | "expanded" | "fullscreen";
  avatarStyle: "professional" | "anime" | "abstract" | "pixel";

  // Trading settings
  warRoomConsensusThreshold: number;
  defaultStake: number;
  autoLockoutEnabled: boolean;
  autoLockoutAt: number;

  // Display settings
  sidebarCollapsed: boolean;

  // Setters
  setArenaAnimationsEnabled: (v: boolean) => void;
  setArenaScreenShakeEnabled: (v: boolean) => void;
  setArenaSoundEnabled: (v: boolean) => void;
  setArenaSize: (v: SettingsState["arenaSize"]) => void;
  setAvatarStyle: (v: SettingsState["avatarStyle"]) => void;
  setWarRoomConsensusThreshold: (v: number) => void;
  setDefaultStake: (v: number) => void;
  setAutoLockoutEnabled: (v: boolean) => void;
  setAutoLockoutAt: (v: number) => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      arenaAnimationsEnabled: true,
      arenaScreenShakeEnabled: true,
      arenaSoundEnabled: true,
      arenaSize: "compact",
      avatarStyle: "professional",
      warRoomConsensusThreshold: 60,
      defaultStake: 10,
      autoLockoutEnabled: false,
      autoLockoutAt: 80,
      sidebarCollapsed: false,

      setArenaAnimationsEnabled: (arenaAnimationsEnabled) => set({ arenaAnimationsEnabled }),
      setArenaScreenShakeEnabled: (arenaScreenShakeEnabled) => set({ arenaScreenShakeEnabled }),
      setArenaSoundEnabled: (arenaSoundEnabled) => set({ arenaSoundEnabled }),
      setArenaSize: (arenaSize) => set({ arenaSize }),
      setAvatarStyle: (avatarStyle) => set({ avatarStyle }),
      setWarRoomConsensusThreshold: (warRoomConsensusThreshold) =>
        set({ warRoomConsensusThreshold }),
      setDefaultStake: (defaultStake) => set({ defaultStake }),
      setAutoLockoutEnabled: (autoLockoutEnabled) => set({ autoLockoutEnabled }),
      setAutoLockoutAt: (autoLockoutAt) => set({ autoLockoutAt }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    {
      name: "phantom-ledger-settings",
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0) {
          return { ...state, arenaSoundEnabled: true };
        }
        return state;
      },
    }
  )
);
