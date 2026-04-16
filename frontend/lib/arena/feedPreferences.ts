'use strict';

export type ArenaFeedId = 'deriv_ticks' | 'sentiment' | 'pattern' | 'partner';

export interface ArenaFeedPreferences {
  /** Deriv underlying symbol (e.g. 1HZ100V). */
  selectedMarket: string;
  enabledFeeds: Record<ArenaFeedId, boolean>;
}

export const ARENA_FEED_PREFS_KEY = 'derivarena-arena-feed-prefs-v1';

/** Fired on `window` after preferences persist (same-tab; `storage` only fires in other tabs). */
export const ARENA_FEED_PREFS_CHANGED_EVENT = 'derivarena-arena-feed-prefs-changed';

export const DEFAULT_ARENA_FEED_PREFERENCES: ArenaFeedPreferences = {
  selectedMarket: '1HZ100V',
  enabledFeeds: {
    deriv_ticks: true,
    sentiment: true,
    pattern: true,
    partner: false,
  },
};

function sanitizeSymbol(raw: string): string {
  const s = raw.replace(/[^\w]/g, '').slice(0, 24);
  return s || DEFAULT_ARENA_FEED_PREFERENCES.selectedMarket;
}

export function loadArenaFeedPreferences(): ArenaFeedPreferences {
  if (typeof window === 'undefined') return { ...DEFAULT_ARENA_FEED_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(ARENA_FEED_PREFS_KEY);
    if (!raw) return { ...DEFAULT_ARENA_FEED_PREFERENCES };
    const o = JSON.parse(raw) as Record<string, unknown>;
    const selectedMarket =
      typeof o.selectedMarket === 'string' && o.selectedMarket
        ? sanitizeSymbol(o.selectedMarket)
        : DEFAULT_ARENA_FEED_PREFERENCES.selectedMarket;
    const ef = o.enabledFeeds && typeof o.enabledFeeds === 'object' && !Array.isArray(o.enabledFeeds)
      ? (o.enabledFeeds as Record<string, unknown>)
      : {};
    const enabledFeeds: Record<ArenaFeedId, boolean> = { ...DEFAULT_ARENA_FEED_PREFERENCES.enabledFeeds };
    (['deriv_ticks', 'sentiment', 'pattern', 'partner'] as const).forEach((k) => {
      if (typeof ef[k] === 'boolean') enabledFeeds[k] = ef[k]!;
    });
    return { selectedMarket, enabledFeeds };
  } catch {
    return { ...DEFAULT_ARENA_FEED_PREFERENCES };
  }
}

export function persistArenaFeedPreferences(next: ArenaFeedPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      ARENA_FEED_PREFS_KEY,
      JSON.stringify({
        selectedMarket: sanitizeSymbol(next.selectedMarket),
        enabledFeeds: next.enabledFeeds,
      }),
    );
    // Defer so listeners (other `useArenaFeedPreferences` instances) never call setState
    // during another component's setState updater — avoids React cascade warning.
    queueMicrotask(() => {
      window.dispatchEvent(new Event(ARENA_FEED_PREFS_CHANGED_EVENT));
    });
  } catch {
    /* quota / private mode */
  }
}
