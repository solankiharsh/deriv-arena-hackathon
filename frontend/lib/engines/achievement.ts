"use strict";

export interface BadgeDefinition {
  id: string;
  name: string;
  emoji: string;
  description: string;
  tiers: [
    { label: string; target: number },
    { label: string; target: number },
    { label: string; target: number }
  ];
  xp: [number, number, number];
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: "diamond_hands",
    name: "Diamond Hands",
    emoji: "💎",
    description: "Hold winning trades to full expiry",
    tiers: [
      { label: "Bronze", target: 5 },
      { label: "Silver", target: 25 },
      { label: "Gold", target: 100 },
    ],
    xp: [100, 300, 1000],
  },
  {
    id: "cool_head",
    name: "Cool Head",
    emoji: "🧊",
    description: "Wait 5+ minutes after a loss before next trade",
    tiers: [
      { label: "Bronze", target: 10 },
      { label: "Silver", target: 25 },
      { label: "Gold", target: 50 },
    ],
    xp: [100, 250, 750],
  },
  {
    id: "firewall",
    name: "Firewall Respected",
    emoji: "🛡️",
    description: "Accept the Pre-Mortem Step Away suggestion",
    tiers: [
      { label: "Bronze", target: 5 },
      { label: "Silver", target: 15 },
      { label: "Gold", target: 30 },
    ],
    xp: [150, 400, 1200],
  },
  {
    id: "shadow_boxer",
    name: "Shadow Boxer",
    emoji: "👁️",
    description: "Beat Anti-You for consecutive trading days",
    tiers: [
      { label: "Bronze", target: 5 },
      { label: "Silver", target: 10 },
      { label: "Gold", target: 20 },
    ],
    xp: [200, 500, 1500],
  },
  {
    id: "tilt_survivor",
    name: "Tilt Survivor",
    emoji: "🔥",
    description: "Reach tilt 60+ and voluntarily stop trading",
    tiers: [
      { label: "Bronze", target: 1 },
      { label: "Silver", target: 5 },
      { label: "Gold", target: 15 },
    ],
    xp: [300, 750, 2000],
  },
  {
    id: "zero_revenge",
    name: "Zero Revenge Week",
    emoji: "⛔",
    description: "Full week with zero revenge-trading flags",
    tiers: [
      { label: "Bronze", target: 1 },
      { label: "Silver", target: 4 },
      { label: "Gold", target: 12 },
    ],
    xp: [500, 1500, 5000],
  },
  {
    id: "behavioral_profit",
    name: "Behavioral Profit",
    emoji: "💰",
    description: "Behavioral savings exceed costs for a full month",
    tiers: [
      { label: "Bronze", target: 1 },
      { label: "Silver", target: 3 },
      { label: "Gold", target: 6 },
    ],
    xp: [500, 1500, 4000],
  },
  {
    id: "self_aware",
    name: "Self-Aware",
    emoji: "🧠",
    description: "Maintain BES score 75+ for consecutive weeks",
    tiers: [
      { label: "Bronze", target: 2 },
      { label: "Silver", target: 4 },
      { label: "Gold", target: 8 },
    ],
    xp: [400, 1200, 4000],
  },
  {
    id: "phantom_master",
    name: "Phantom Master",
    emoji: "🏆",
    description: "Unlock all other badges at any tier",
    tiers: [
      { label: "Bronze", target: 3 },
      { label: "Silver", target: 6 },
      { label: "Gold", target: 8 },
    ],
    xp: [1000, 3000, 10000],
  },
];

export function getBadge(id: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.id === id);
}

export type RankName = "Iron" | "Bronze" | "Silver" | "Gold" | "Platinum";
export type SubTier = "I" | "II" | "III";

export interface RankInfo {
  rank: RankName;
  subTier: SubTier;
  level: number;
  color: string;
  nextThreshold: number;
  currentThreshold: number;
  progress: number;
  totalXp: number;
}

const RANK_COLORS: Record<RankName, string> = {
  Iron: "#71717a",
  Bronze: "#cd7f32",
  Silver: "#c0c0c0",
  Gold: "#fbbf24",
  Platinum: "#06b6d4",
};

const RANK_THRESHOLDS: { rank: RankName; subTier: SubTier; threshold: number }[] = [
  { rank: "Iron",     subTier: "I",   threshold: 0 },
  { rank: "Iron",     subTier: "II",  threshold: 250 },
  { rank: "Iron",     subTier: "III", threshold: 500 },
  { rank: "Bronze",   subTier: "I",   threshold: 1000 },
  { rank: "Bronze",   subTier: "II",  threshold: 2500 },
  { rank: "Bronze",   subTier: "III", threshold: 5000 },
  { rank: "Silver",   subTier: "I",   threshold: 7500 },
  { rank: "Silver",   subTier: "II",  threshold: 12000 },
  { rank: "Silver",   subTier: "III", threshold: 18000 },
  { rank: "Gold",     subTier: "I",   threshold: 25000 },
  { rank: "Gold",     subTier: "II",  threshold: 40000 },
  { rank: "Gold",     subTier: "III", threshold: 60000 },
  { rank: "Platinum", subTier: "I",   threshold: 80000 },
  { rank: "Platinum", subTier: "II",  threshold: 120000 },
  { rank: "Platinum", subTier: "III", threshold: 200000 },
];

export function xpToRank(totalXp: number): RankInfo {
  let idx = 0;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
    if (totalXp >= RANK_THRESHOLDS[i].threshold) {
      idx = i;
    }
  }

  const current = RANK_THRESHOLDS[idx];
  const next = RANK_THRESHOLDS[idx + 1] ?? null;
  const nextThreshold = next ? next.threshold : current.threshold;
  const range = nextThreshold - current.threshold;
  const progress = range > 0
    ? Math.min(100, Math.round(((totalXp - current.threshold) / range) * 100))
    : 100;

  return {
    rank: current.rank,
    subTier: current.subTier,
    level: idx + 1,
    color: RANK_COLORS[current.rank],
    nextThreshold,
    currentThreshold: current.threshold,
    progress,
    totalXp,
  };
}

export function formatRank(info: RankInfo): string {
  return `${info.rank} ${info.subTier}`;
}

export { RANK_COLORS };
