"use client";

import { create } from "zustand";
import type { Phantom } from "../db/schema";

interface PhantomAnalytics {
  winRateByTier: Record<string, number>;
  hesitationCost: number;
  smartAvoidanceCount: number;
  smartAvoidanceValue: number;
  assetPerformance: Record<string, { wins: number; losses: number; pnl: number }>;
  totalPhantomPnl: number;
  phantomWinRate: number;
}

interface PhantomState {
  activePhantoms: Phantom[];
  resolvedPhantoms: Phantom[];
  analytics: PhantomAnalytics;

  addPhantom: (phantom: Phantom) => void;
  updatePhantom: (id: string, updates: Partial<Phantom>) => void;
  resolvePhantom: (id: string, finalPnl: number, status: Phantom["status"]) => void;
  setActivePhantoms: (phantoms: Phantom[]) => void;
  setResolvedPhantoms: (phantoms: Phantom[]) => void;
  recalculateAnalytics: () => void;
  clearSession: () => void;
}

function calculateAnalytics(
  active: Phantom[],
  resolved: Phantom[]
): PhantomAnalytics {
  const all = [...active, ...resolved];
  const winRateByTier: Record<string, { wins: number; total: number }> = {};
  let hesitationCost = 0;
  let smartAvoidanceCount = 0;
  let smartAvoidanceValue = 0;
  const assetPerformance: Record<string, { wins: number; losses: number; pnl: number }> = {};
  let totalWins = 0;

  for (const p of resolved) {
    const tier = p.confidenceTier;
    if (!winRateByTier[tier]) winRateByTier[tier] = { wins: 0, total: 0 };
    winRateByTier[tier].total++;

    const pnl = p.finalPnl ?? 0;
    if (pnl > 0) {
      winRateByTier[tier].wins++;
      hesitationCost += pnl;
      totalWins++;
    } else if (pnl < 0) {
      smartAvoidanceCount++;
      smartAvoidanceValue += Math.abs(pnl);
    }

    if (!assetPerformance[p.asset]) {
      assetPerformance[p.asset] = { wins: 0, losses: 0, pnl: 0 };
    }
    assetPerformance[p.asset].pnl += pnl;
    if (pnl > 0) assetPerformance[p.asset].wins++;
    else if (pnl < 0) assetPerformance[p.asset].losses++;
  }

  const winRateMap: Record<string, number> = {};
  for (const [tier, stats] of Object.entries(winRateByTier)) {
    winRateMap[tier] = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
  }

  const totalPnl = resolved.reduce((sum, p) => sum + (p.finalPnl ?? 0), 0);

  return {
    winRateByTier: winRateMap,
    hesitationCost,
    smartAvoidanceCount,
    smartAvoidanceValue,
    assetPerformance,
    totalPhantomPnl: totalPnl,
    phantomWinRate: resolved.length > 0 ? (totalWins / resolved.length) * 100 : 0,
  };
}

export const usePhantomStore = create<PhantomState>()((set, get) => ({
  activePhantoms: [],
  resolvedPhantoms: [],
  analytics: {
    winRateByTier: {},
    hesitationCost: 0,
    smartAvoidanceCount: 0,
    smartAvoidanceValue: 0,
    assetPerformance: {},
    totalPhantomPnl: 0,
    phantomWinRate: 0,
  },

  addPhantom: (phantom) =>
    set((state) => {
      const updated = [...state.activePhantoms, phantom];
      return {
        activePhantoms: updated,
        analytics: calculateAnalytics(updated, state.resolvedPhantoms),
      };
    }),

  updatePhantom: (id, updates) =>
    set((state) => ({
      activePhantoms: state.activePhantoms.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  resolvePhantom: (id, finalPnl, status) =>
    set((state) => {
      const phantom = state.activePhantoms.find((p) => p.id === id);
      if (!phantom) return state;

      const resolved = { ...phantom, finalPnl, status, resolvedAt: Date.now() };
      const active = state.activePhantoms.filter((p) => p.id !== id);
      const resolvedList = [resolved, ...state.resolvedPhantoms];

      return {
        activePhantoms: active,
        resolvedPhantoms: resolvedList,
        analytics: calculateAnalytics(active, resolvedList),
      };
    }),

  setActivePhantoms: (activePhantoms) =>
    set((state) => ({
      activePhantoms,
      analytics: calculateAnalytics(activePhantoms, state.resolvedPhantoms),
    })),

  setResolvedPhantoms: (resolvedPhantoms) =>
    set((state) => ({
      resolvedPhantoms,
      analytics: calculateAnalytics(state.activePhantoms, resolvedPhantoms),
    })),

  recalculateAnalytics: () =>
    set((state) => ({
      analytics: calculateAnalytics(state.activePhantoms, state.resolvedPhantoms),
    })),

  clearSession: () =>
    set({
      activePhantoms: [],
      resolvedPhantoms: [],
      analytics: {
        winRateByTier: {},
        hesitationCost: 0,
        smartAvoidanceCount: 0,
        smartAvoidanceValue: 0,
        assetPerformance: {},
        totalPhantomPnl: 0,
        phantomWinRate: 0,
      },
    }),
}));
