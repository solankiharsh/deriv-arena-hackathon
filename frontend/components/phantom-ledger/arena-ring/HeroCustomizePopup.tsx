"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Shield, Palette, Swords } from "lucide-react";
import { useHeroStore } from "@/lib/stores/hero-store";
import { HEROES, HERO_LIST, RING_THEMES, type RingTheme } from "@/lib/arena/hero-data";
import { SPRITE_CHARACTER_LIST, type SpriteCharacterId } from "@/lib/arena/sprite-data";
import { AnimeHeroFighter } from "./AnimeHeroFighter";
import { SpriteAnimator } from "./SpriteAnimator";

type TabId = "sprite" | "css" | "ring";

export function HeroCustomizePopup() {
  const {
    isCustomizeOpen, closeCustomize,
    fighterMode, selectedHero, selectedSprite,
    setHero, setSprite, setRingTheme, selectedRingTheme,
  } = useHeroStore();

  const [tab, setTab] = useState<TabId>(fighterMode === "sprite" ? "sprite" : "css");

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "sprite", label: "Anime Fighters", icon: <Swords size={12} /> },
    { id: "css", label: "Element Heroes", icon: <Shield size={12} /> },
    { id: "ring", label: "Ring Theme", icon: <Palette size={12} /> },
  ];

  return (
    <AnimatePresence>
      {isCustomizeOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          onClick={closeCustomize}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative glass rounded-2xl border border-[var(--color-border)] overflow-hidden"
            style={{ width: 720, maxHeight: "85vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-[var(--color-phantom)]" />
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Choose Your Fighter</h2>
              </div>
              <button
                onClick={closeCustomize}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                aria-label="Close fighter customization"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[var(--color-border)]">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors relative"
                  style={{
                    color: tab === t.id ? "var(--color-phantom)" : "var(--color-text-muted)",
                  }}
                >
                  {t.icon}
                  {t.label}
                  {tab === t.id && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-phantom)]"
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto p-5 space-y-6" style={{ maxHeight: "calc(85vh - 120px)" }}>

              {/* ── SPRITE FIGHTERS TAB ── */}
              {tab === "sprite" && (
                <>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    Actual anime sprite characters with real frame-by-frame animations. CC0 licensed.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {SPRITE_CHARACTER_LIST.map((char) => {
                      const isSelected = fighterMode === "sprite" && selectedSprite === char.id;
                      return (
                        <button
                          key={char.id}
                          onClick={() => setSprite(char.id)}
                          className="relative rounded-xl p-4 border transition-all group text-left"
                          style={{
                            borderColor: isSelected ? `${char.color}60` : "var(--color-border)",
                            background: isSelected ? `${char.color}10` : "transparent",
                            boxShadow: isSelected ? `0 0 20px ${char.color}15` : "none",
                          }}
                        >
                          <div className="flex items-center gap-4">
                            {/* Hero preview */}
                            <div className="flex-shrink-0">
                              <SpriteAnimator
                                character={char}
                                action="idle"
                                isVillain={false}
                                health={100}
                                width={100}
                                height={100}
                              />
                            </div>

                            <div className="text-xs text-center flex-shrink-0 text-[var(--color-text-muted)] font-bold">VS</div>

                            {/* Villain preview */}
                            <div className="flex-shrink-0">
                              <SpriteAnimator
                                character={char}
                                action="idle"
                                isVillain={true}
                                health={100}
                                width={100}
                                height={100}
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div>
                              <div className="text-sm font-bold" style={{ color: char.color }}>{char.name}</div>
                              <div className="text-[9px] text-[var(--color-text-muted)]">Hero</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold" style={{ color: char.villainColor }}>Anti-{char.name}</div>
                              <div className="text-[9px] text-[var(--color-text-muted)]">Villain</div>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--color-phantom)] flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── CSS ELEMENT HEROES TAB ── */}
              {tab === "css" && (
                <>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    10 element-based CSS heroes with unique attacks, colors, and villains.
                  </p>
                  <div className="grid grid-cols-5 gap-3">
                    {HERO_LIST.map((hero) => {
                      const isSelected = fighterMode === "css" && selectedHero === hero.id;
                      return (
                        <button
                          key={hero.id}
                          onClick={() => setHero(hero.id)}
                          className="relative rounded-xl p-3 border transition-all text-center group"
                          style={{
                            borderColor: isSelected ? `${hero.color}60` : "var(--color-border)",
                            background: isSelected ? `${hero.color}10` : "transparent",
                            boxShadow: isSelected ? `0 0 16px ${hero.color}15` : "none",
                          }}
                        >
                          <div className="mx-auto mb-2 relative" style={{ width: 48, height: 72 }}>
                            <div style={{ transform: "scale(0.4)", transformOrigin: "top center" }}>
                              <AnimeHeroFighter hero={hero} isVillain={false} action="idle" health={100} />
                            </div>
                          </div>
                          <div
                            className="text-[9px] font-bold truncate"
                            style={{ color: isSelected ? hero.color : "var(--color-text-secondary)" }}
                          >
                            {hero.name}
                          </div>
                          <div className="text-[7px] text-[var(--color-text-muted)] truncate">
                            {hero.element}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected hero detail */}
                  {fighterMode === "css" && (() => {
                    const hero = HEROES[selectedHero];
                    return (
                      <div
                        className="rounded-xl p-4 border"
                        style={{ borderColor: `${hero.color}30`, background: `${hero.color}08` }}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex gap-6">
                            <div className="text-center">
                              <div className="relative" style={{ width: 80, height: 120 }}>
                                <div style={{ transform: "scale(0.65)", transformOrigin: "top center" }}>
                                  <AnimeHeroFighter hero={hero} isVillain={false} action="idle" health={100} />
                                </div>
                              </div>
                              <div className="text-[9px] font-bold mt-1" style={{ color: hero.color }}>
                                {hero.name}
                              </div>
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted)] py-1">VS</div>
                            <div className="text-center">
                              <div className="relative" style={{ width: 80, height: 120 }}>
                                <div style={{ transform: "scale(0.65)", transformOrigin: "top center" }}>
                                  <AnimeHeroFighter hero={hero} isVillain={true} action="idle" health={100} />
                                </div>
                              </div>
                              <div className="text-[9px] font-bold mt-1" style={{ color: hero.villainAccent }}>
                                {hero.villainName}
                              </div>
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-[var(--color-text-primary)] uppercase tracking-wide mb-2">
                              Attacks
                            </div>
                            <div className="space-y-1.5">
                              {hero.attacks.map((atk, i) => (
                                <div key={atk.name} className="flex items-center gap-2 text-[10px]">
                                  <div
                                    className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold flex-shrink-0"
                                    style={{ background: `${hero.color}20`, color: hero.color }}
                                  >
                                    {i + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-semibold text-[var(--color-text-primary)]">{atk.name}</span>
                                    <span className="text-[var(--color-text-muted)] ml-1">— {atk.description}</span>
                                  </div>
                                  <span className="text-[9px] font-bold tabular-nums" style={{ color: hero.color }}>
                                    {atk.damage} DMG
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* ── RING THEME TAB ── */}
              {tab === "ring" && (
                <div className="grid grid-cols-5 gap-3">
                  {(Object.entries(RING_THEMES) as [RingTheme, typeof RING_THEMES[RingTheme]][]).map(([id, theme]) => {
                    const isSelected = selectedRingTheme === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setRingTheme(id)}
                        className="rounded-xl p-3 border transition-all text-center"
                        style={{
                          borderColor: isSelected ? "var(--color-phantom)" : "var(--color-border)",
                          background: isSelected ? "var(--color-phantom-dim)" : "transparent",
                        }}
                      >
                        <div
                          className="w-full h-12 rounded-lg mb-2 border border-white/5"
                          style={{ background: theme.bgGradient }}
                        >
                          <div className="h-full w-full rounded-lg" style={{ background: theme.floorGradient }} />
                        </div>
                        <div className="text-[9px] font-semibold text-[var(--color-text-secondary)]">
                          {theme.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
