'use client';

import { useCallback } from 'react';
import { sfx, type SfxName } from '@/lib/sounds';
import { useSettingsStore } from '@/lib/stores/settings-store';

/**
 * React hook for playing sound effects.
 * Automatically respects the `arenaSoundEnabled` toggle.
 */
export function useSfx() {
  const enabled = useSettingsStore(s => s.arenaSoundEnabled);

  const play = useCallback(
    (name: SfxName) => {
      if (enabled) sfx.play(name);
    },
    [enabled],
  );

  return { play, enabled };
}
