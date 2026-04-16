"use strict";

export type HeroId =
  | "blazeKnight"
  | "frostMage"
  | "shadowNinja"
  | "thunderSamurai"
  | "ironGolem"
  | "spiritMonk"
  | "voidAssassin"
  | "stormArcher"
  | "crimsonBerserker"
  | "jadeDragon";

export type RingTheme = "classic" | "dojo" | "arena" | "neon" | "inferno";

export interface HeroAttack {
  name: string;
  minProfitPct: number;
  animation: string;
  damage: number;
  description: string;
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  title: string;
  villainName: string;
  villainTitle: string;
  color: string;
  villainColor: string;
  accentColor: string;
  villainAccent: string;
  attacks: [HeroAttack, HeroAttack, HeroAttack];
  stance: string;
  element: string;
}

export const HEROES: Record<HeroId, HeroDefinition> = {
  blazeKnight: {
    id: "blazeKnight",
    name: "Blaze Knight",
    title: "Flame Commander",
    villainName: "Ash Wraith",
    villainTitle: "Ember Devourer",
    color: "#FF6B35",
    villainColor: "#4A1A2E",
    accentColor: "#FFD700",
    villainAccent: "#8B0000",
    attacks: [
      { name: "Ember Strike", minProfitPct: 0, animation: "jab", damage: 8, description: "Quick flame jab" },
      { name: "Inferno Slash", minProfitPct: 3, animation: "hook", damage: 15, description: "Sweeping fire arc" },
      { name: "Dragon Burst", minProfitPct: 8, animation: "uppercut", damage: 25, description: "Explosive uppercut" },
    ],
    stance: "aggressive",
    element: "fire",
  },
  frostMage: {
    id: "frostMage",
    name: "Frost Mage",
    title: "Ice Sovereign",
    villainName: "Blizzard Fiend",
    villainTitle: "Frozen Tyrant",
    color: "#00D4FF",
    villainColor: "#1A0A3E",
    accentColor: "#E0F7FF",
    villainAccent: "#6A0DAD",
    attacks: [
      { name: "Ice Shard", minProfitPct: 0, animation: "jab", damage: 7, description: "Frozen needle" },
      { name: "Glacial Wave", minProfitPct: 3, animation: "body-blow", damage: 14, description: "Freezing torrent" },
      { name: "Absolute Zero", minProfitPct: 8, animation: "uppercut", damage: 28, description: "Total freeze shatter" },
    ],
    stance: "defensive",
    element: "ice",
  },
  shadowNinja: {
    id: "shadowNinja",
    name: "Shadow Ninja",
    title: "Void Walker",
    villainName: "Phantom Blade",
    villainTitle: "Dark Mirror",
    color: "#8B5CF6",
    villainColor: "#1A0A2E",
    accentColor: "#C4B5FD",
    villainAccent: "#DC143C",
    attacks: [
      { name: "Shadow Step", minProfitPct: 0, animation: "jab", damage: 9, description: "Teleport strike" },
      { name: "Void Slash", minProfitPct: 3, animation: "hook", damage: 16, description: "Dimensional cut" },
      { name: "Death Blossom", minProfitPct: 8, animation: "body-blow", damage: 24, description: "Multi-shadow assault" },
    ],
    stance: "evasive",
    element: "shadow",
  },
  thunderSamurai: {
    id: "thunderSamurai",
    name: "Thunder Samurai",
    title: "Storm Blade",
    villainName: "Thunder Oni",
    villainTitle: "Lightning Demon",
    color: "#FBBF24",
    villainColor: "#2D1B00",
    accentColor: "#FEF3C7",
    villainAccent: "#7C3AED",
    attacks: [
      { name: "Lightning Draw", minProfitPct: 0, animation: "jab", damage: 10, description: "Iaido flash" },
      { name: "Storm Cleave", minProfitPct: 3, animation: "hook", damage: 18, description: "Thunder arc" },
      { name: "Divine Thunder", minProfitPct: 8, animation: "uppercut", damage: 30, description: "Heaven's wrath" },
    ],
    stance: "balanced",
    element: "lightning",
  },
  ironGolem: {
    id: "ironGolem",
    name: "Iron Golem",
    title: "Steel Guardian",
    villainName: "Rust Titan",
    villainTitle: "Corrosion King",
    color: "#71717A",
    villainColor: "#1C1917",
    accentColor: "#D4D4D8",
    villainAccent: "#B45309",
    attacks: [
      { name: "Iron Fist", minProfitPct: 0, animation: "jab", damage: 6, description: "Heavy metal strike" },
      { name: "Earthquake Slam", minProfitPct: 3, animation: "body-blow", damage: 20, description: "Ground-shaking blow" },
      { name: "Meteor Crush", minProfitPct: 8, animation: "uppercut", damage: 35, description: "Devastating overhead" },
    ],
    stance: "tank",
    element: "earth",
  },
  spiritMonk: {
    id: "spiritMonk",
    name: "Spirit Monk",
    title: "Chi Master",
    villainName: "Corrupt Sage",
    villainTitle: "Dark Chi",
    color: "#22C55E",
    villainColor: "#1A2E1A",
    accentColor: "#BBF7D0",
    villainAccent: "#B91C1C",
    attacks: [
      { name: "Palm Strike", minProfitPct: 0, animation: "jab", damage: 8, description: "Chi-infused palm" },
      { name: "Dragon Kick", minProfitPct: 3, animation: "hook", damage: 14, description: "Spinning chi kick" },
      { name: "Spirit Bomb", minProfitPct: 8, animation: "uppercut", damage: 26, description: "Concentrated life force" },
    ],
    stance: "balanced",
    element: "chi",
  },
  voidAssassin: {
    id: "voidAssassin",
    name: "Void Assassin",
    title: "Rift Stalker",
    villainName: "Abyss Hunter",
    villainTitle: "Null Entity",
    color: "#EC4899",
    villainColor: "#2D0A1F",
    accentColor: "#FBCFE8",
    villainAccent: "#064E3B",
    attacks: [
      { name: "Rift Stab", minProfitPct: 0, animation: "jab", damage: 11, description: "Phase-through pierce" },
      { name: "Dimension Rend", minProfitPct: 3, animation: "hook", damage: 17, description: "Reality-tearing slash" },
      { name: "Event Horizon", minProfitPct: 8, animation: "body-blow", damage: 27, description: "Singularity collapse" },
    ],
    stance: "aggressive",
    element: "void",
  },
  stormArcher: {
    id: "stormArcher",
    name: "Storm Archer",
    title: "Wind Sniper",
    villainName: "Gale Predator",
    villainTitle: "Tornado Fiend",
    color: "#06B6D4",
    villainColor: "#0A1628",
    accentColor: "#CFFAFE",
    villainAccent: "#9F1239",
    attacks: [
      { name: "Wind Arrow", minProfitPct: 0, animation: "jab", damage: 9, description: "Piercing gust shot" },
      { name: "Tempest Volley", minProfitPct: 3, animation: "hook", damage: 15, description: "Multi-arrow storm" },
      { name: "Cyclone Barrage", minProfitPct: 8, animation: "uppercut", damage: 24, description: "Tornado of arrows" },
    ],
    stance: "ranged",
    element: "wind",
  },
  crimsonBerserker: {
    id: "crimsonBerserker",
    name: "Crimson Berserker",
    title: "Blood Warden",
    villainName: "Scarlet Demon",
    villainTitle: "Rage Incarnate",
    color: "#EF4444",
    villainColor: "#2D0808",
    accentColor: "#FCA5A5",
    villainAccent: "#1E3A5F",
    attacks: [
      { name: "Rage Slash", minProfitPct: 0, animation: "hook", damage: 12, description: "Berserk swing" },
      { name: "Blood Rush", minProfitPct: 3, animation: "body-blow", damage: 19, description: "Charging tackle" },
      { name: "Crimson Apocalypse", minProfitPct: 8, animation: "uppercut", damage: 32, description: "Unstoppable rage burst" },
    ],
    stance: "aggressive",
    element: "blood",
  },
  jadeDragon: {
    id: "jadeDragon",
    name: "Jade Dragon",
    title: "Emerald Emperor",
    villainName: "Obsidian Wyrm",
    villainTitle: "Dark Serpent",
    color: "#10B981",
    villainColor: "#0A1F1A",
    accentColor: "#A7F3D0",
    villainAccent: "#7C2D12",
    attacks: [
      { name: "Jade Claw", minProfitPct: 0, animation: "jab", damage: 10, description: "Gem-charged strike" },
      { name: "Dragon Tail", minProfitPct: 3, animation: "hook", damage: 16, description: "Sweeping tail whip" },
      { name: "Celestial Breath", minProfitPct: 8, animation: "uppercut", damage: 28, description: "Divine dragon fire" },
    ],
    stance: "balanced",
    element: "jade",
  },
};

export const HERO_LIST = Object.values(HEROES);

export const RING_THEMES: Record<RingTheme, {
  name: string;
  floorGradient: string;
  ropeColor: string;
  ambientColor: string;
  bgGradient: string;
}> = {
  classic: {
    name: "Classic Arena",
    floorGradient: "linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.03))",
    ropeColor: "rgba(255,255,255,0.06)",
    ambientColor: "rgba(255,255,255,0.02)",
    bgGradient: "linear-gradient(180deg, #1a1a24 0%, rgba(26,26,36,0.97) 40%, rgba(32,32,46,0.95) 100%)",
  },
  dojo: {
    name: "Dojo",
    floorGradient: "linear-gradient(180deg, rgba(139,92,246,0.03), rgba(139,92,246,0.06))",
    ropeColor: "rgba(139,92,246,0.12)",
    ambientColor: "rgba(139,92,246,0.03)",
    bgGradient: "linear-gradient(180deg, #1a0a2e 0%, #12071e 40%, #1a1028 100%)",
  },
  arena: {
    name: "Colosseum",
    floorGradient: "linear-gradient(180deg, rgba(205,127,50,0.03), rgba(205,127,50,0.06))",
    ropeColor: "rgba(205,127,50,0.12)",
    ambientColor: "rgba(205,127,50,0.03)",
    bgGradient: "linear-gradient(180deg, #1c1408 0%, #2a1f0e 40%, #1a1408 100%)",
  },
  neon: {
    name: "Neon City",
    floorGradient: "linear-gradient(180deg, rgba(6,182,212,0.03), rgba(236,72,153,0.04))",
    ropeColor: "rgba(6,182,212,0.15)",
    ambientColor: "rgba(236,72,153,0.03)",
    bgGradient: "linear-gradient(180deg, #0a0a1a 0%, #0f0520 40%, #0a0a1a 100%)",
  },
  inferno: {
    name: "Inferno Pit",
    floorGradient: "linear-gradient(180deg, rgba(239,68,68,0.04), rgba(249,115,22,0.06))",
    ropeColor: "rgba(239,68,68,0.12)",
    ambientColor: "rgba(249,115,22,0.04)",
    bgGradient: "linear-gradient(180deg, #1a0808 0%, #2d0808 40%, #1a0505 100%)",
  },
};

export function selectAttack(hero: HeroDefinition, profitPct: number): HeroAttack {
  if (profitPct >= hero.attacks[2].minProfitPct) return hero.attacks[2];
  if (profitPct >= hero.attacks[1].minProfitPct) return hero.attacks[1];
  return hero.attacks[0];
}
