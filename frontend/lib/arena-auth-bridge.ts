'use client';

import { useArenaAuth } from '@/store/arenaAuthStore';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';
import type { AgentProfile } from '@/lib/types';

/**
 * Bridges arena auth into the legacy `useAuthStore` used by
 * Command Center, Map, and Discussions components.
 *
 * Call once in each wrapper tab component; it writes a synthetic
 * agent profile into useAuthStore so downstream components read
 * `isAuthenticated === true` and render their UI.
 */
export function useArenaAuthBridge() {
  const { user } = useArenaAuth();
  const { isAuthenticated, setAuth, _hasHydrated, setHasHydrated } = useAuthStore();

  useEffect(() => {
    if (!_hasHydrated) {
      setHasHydrated(true);
    }
  }, [_hasHydrated, setHasHydrated]);

  useEffect(() => {
    if (user && !isAuthenticated) {
      const syntheticAgent: AgentProfile = {
        id: user.id,
        pubkey: '',
        walletAddress: '',
        name: user.display_name || 'Arena Player',
        avatarUrl: null,
        bio: null,
        twitterHandle: null,
        status: 'active',
        xp: 0,
        level: 1,
        levelName: 'Rookie',
        xpForNextLevel: 100,
        totalTrades: user.total_games ?? 0,
        winRate: user.total_games > 0
          ? (user.total_wins / user.total_games) * 100
          : 0,
        totalPnl: 0,
        onboardingComplete: true,
        createdAt: new Date().toISOString(),
      };
      setAuth(syntheticAgent, [], 100);
    }
  }, [user, isAuthenticated, setAuth]);

  return { isBridged: true, arenaUser: user };
}
