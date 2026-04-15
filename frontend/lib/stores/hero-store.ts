"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HeroId, RingTheme } from "@/lib/arena/hero-data";
import type { SpriteCharacterId } from "@/lib/arena/sprite-data";

type FighterMode = "css" | "sprite";

interface HeroState {
  fighterMode: FighterMode;
  selectedHero: HeroId;
  selectedSprite: SpriteCharacterId;
  selectedRingTheme: RingTheme;
  isCustomizeOpen: boolean;

  setFighterMode: (mode: FighterMode) => void;
  setHero: (id: HeroId) => void;
  setSprite: (id: SpriteCharacterId) => void;
  setRingTheme: (theme: RingTheme) => void;
  openCustomize: () => void;
  closeCustomize: () => void;
}

export const useHeroStore = create<HeroState>()(
  persist(
    (set) => ({
      fighterMode: "sprite",
      selectedHero: "blazeKnight",
      selectedSprite: "samuraiMack",
      selectedRingTheme: "classic",
      isCustomizeOpen: false,

      setFighterMode: (mode) => set({ fighterMode: mode }),
      setHero: (id) => set({ selectedHero: id, fighterMode: "css" }),
      setSprite: (id) => set({ selectedSprite: id, fighterMode: "sprite" }),
      setRingTheme: (theme) => set({ selectedRingTheme: theme }),
      openCustomize: () => set({ isCustomizeOpen: true }),
      closeCustomize: () => set({ isCustomizeOpen: false }),
    }),
    {
      name: "phantom-ledger-hero",
      version: 2,
      partialize: (state) => ({
        fighterMode: state.fighterMode,
        selectedHero: state.selectedHero,
        selectedSprite: state.selectedSprite,
        selectedRingTheme: state.selectedRingTheme,
      }),
    }
  )
);
