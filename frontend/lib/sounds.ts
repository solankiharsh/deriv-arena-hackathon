'use client';

import { useSettingsStore } from '@/lib/stores/settings-store';

export type SfxName =
  | 'trade_place'
  | 'trade_win'
  | 'trade_loss'
  | 'timer_warning'
  | 'game_start'
  | 'game_end'
  | 'ui_click'
  | 'powerup'
  | 'chaos_alert'
  | 'knockout'
  | 'stage_shift'
  | 'orb_capture';

const SOUND_FILES: Record<SfxName, string> = {
  trade_place: '/sounds/trade_place.wav',
  trade_win: '/sounds/trade_win.wav',
  trade_loss: '/sounds/trade_loss.wav',
  timer_warning: '/sounds/timer_warning.wav',
  game_start: '/sounds/game_start.wav',
  game_end: '/sounds/game_end.wav',
  ui_click: '/sounds/ui_click.wav',
  powerup: '/sounds/powerup.wav',
  chaos_alert: '/sounds/chaos_alert.wav',
  knockout: '/sounds/knockout.wav',
  stage_shift: '/sounds/stage_shift.wav',
  orb_capture: '/sounds/orb_capture.wav',
};

const VOLUMES: Partial<Record<SfxName, number>> = {
  ui_click: 0.3,
  timer_warning: 0.5,
  trade_place: 0.4,
  trade_win: 0.5,
  trade_loss: 0.4,
  game_start: 0.6,
  game_end: 0.6,
  powerup: 0.5,
  chaos_alert: 0.5,
  knockout: 0.7,
  stage_shift: 0.5,
  orb_capture: 0.5,
};

type HowlLike = { play: () => number; stop: () => void };
type HowlCtor = new (opts: {
  src: string[];
  format?: string[];
  volume: number;
  preload: boolean;
}) => HowlLike;
type HowlerGlobalLike = {
  ctx?: {
    state?: string;
    resume?: () => Promise<void>;
  };
};

let HowlClass: HowlCtor | null = null;
let HowlerGlobal: HowlerGlobalLike | null = null;
let howlerLoading: Promise<void> | null = null;
const cache = new Map<SfxName, HowlLike>();
let unlockListenersInstalled = false;

function ensureHowler(): Promise<void> {
  if (HowlClass) return Promise.resolve();
  if (typeof window === 'undefined') return Promise.resolve();
  if (howlerLoading) return howlerLoading;

  howlerLoading = import('howler').then((mod) => {
    HowlClass = mod.Howl as unknown as HowlCtor;
    HowlerGlobal = (mod as { Howler?: HowlerGlobalLike }).Howler ?? null;
  });
  return howlerLoading;
}

function installUnlockListeners() {
  if (unlockListenersInstalled || typeof window === 'undefined') return;
  unlockListenersInstalled = true;

  const unlock = () => {
    void ensureHowler().then(() => {
      void HowlerGlobal?.ctx?.resume?.().catch(() => {});
    });
  };

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
}

function getOrCreate(name: SfxName): HowlLike | null {
  if (!HowlClass) return null;
  let howl = cache.get(name);
  if (!howl) {
    howl = new HowlClass({
      src: [SOUND_FILES[name]],
      format: ['wav'],
      volume: VOLUMES[name] ?? 0.5,
      preload: true,
    });
    cache.set(name, howl);
  }
  return howl;
}

export const sfx = {
  prime() {
    if (typeof window === 'undefined') return;
    installUnlockListeners();
    void ensureHowler().then(() => {
      void HowlerGlobal?.ctx?.resume?.().catch(() => {});
      getOrCreate('game_start');
      getOrCreate('trade_place');
      getOrCreate('ui_click');
    });
  },
  play(name: SfxName) {
    if (typeof window === 'undefined') return;
    installUnlockListeners();
    const enabled = useSettingsStore.getState().arenaSoundEnabled;
    if (!enabled) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[sfx] skipped because sound is disabled', { name });
      }
      return;
    }

    ensureHowler().then(() => {
      try {
        void HowlerGlobal?.ctx?.resume?.().catch(() => {});
        const sound = getOrCreate(name);
        const playId = sound?.play();
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[sfx] play requested', { name, playId: playId ?? null });
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[sfx] play failed', { name, error });
        }
        // Audio failures must not break gameplay
      }
    });
  },
};
