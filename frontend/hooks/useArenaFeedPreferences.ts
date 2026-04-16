'use strict';

import { useCallback, useEffect, useState } from 'react';
import {
  ARENA_FEED_PREFS_CHANGED_EVENT,
  ARENA_FEED_PREFS_KEY,
  DEFAULT_ARENA_FEED_PREFERENCES,
  loadArenaFeedPreferences,
  persistArenaFeedPreferences,
  type ArenaFeedId,
  type ArenaFeedPreferences,
} from '@/lib/arena/feedPreferences';

function sanitizeMarket(market: string): string {
  return market.replace(/[^\w]/g, '').slice(0, 24) || DEFAULT_ARENA_FEED_PREFERENCES.selectedMarket;
}

/**
 * Shared Command Center feed toggles + primary symbol (localStorage, same tab + cross-tab).
 */
export function useArenaFeedPreferences() {
  const [prefs, setPrefs] = useState<ArenaFeedPreferences>(() => loadArenaFeedPreferences());

  useEffect(() => {
    const sync = () => setPrefs(loadArenaFeedPreferences());
    const onStorage = (e: StorageEvent) => {
      if (e.key === ARENA_FEED_PREFS_KEY) sync();
    };
    window.addEventListener(ARENA_FEED_PREFS_CHANGED_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(ARENA_FEED_PREFS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setSelectedMarket = useCallback((market: string) => {
    setPrefs((prev) => {
      const next: ArenaFeedPreferences = { ...prev, selectedMarket: sanitizeMarket(market) };
      persistArenaFeedPreferences(next);
      return next;
    });
  }, []);

  const toggleFeed = useCallback((id: ArenaFeedId) => {
    setPrefs((prev) => {
      const next: ArenaFeedPreferences = {
        ...prev,
        enabledFeeds: { ...prev.enabledFeeds, [id]: !prev.enabledFeeds[id] },
      };
      persistArenaFeedPreferences(next);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    const next = { ...DEFAULT_ARENA_FEED_PREFERENCES };
    persistArenaFeedPreferences(next);
    setPrefs(next);
  }, []);

  return {
    selectedMarket: prefs.selectedMarket,
    enabledFeeds: prefs.enabledFeeds,
    setSelectedMarket,
    toggleFeed,
    resetToDefaults,
  };
}
