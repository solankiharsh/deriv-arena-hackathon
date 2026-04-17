/**
 * Mirrors backend/internal/tradingbot/leveling.go — levelThresholds and level names for UI.
 */

import type { Bot } from '@/lib/api/trading-bots';

/** Min cumulative XP to reach level N (1-based); index N-1 in array. */
export const BOT_LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500] as const;

const LEVEL_NAMES = [
  'Rookie',
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Elite',
  'Master',
  'Grandmaster',
  'Legend',
] as const;

export function botLevelName(level: number): string {
  const i = Math.min(Math.max(level, 1), LEVEL_NAMES.length) - 1;
  return LEVEL_NAMES[i] ?? 'Rookie';
}

/** Cumulative XP required to be at least `level` (1–10). */
export function getBotXpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level > BOT_LEVEL_THRESHOLDS.length) {
    return BOT_LEVEL_THRESHOLDS[BOT_LEVEL_THRESHOLDS.length - 1];
  }
  return BOT_LEVEL_THRESHOLDS[level - 1];
}

/**
 * Progress within the current level for the XP bar (matches backend GetLevelForXP curve).
 */
export function getBotXpBar(bot: Bot): {
  percent: number;
  label: string;
  level: number;
  levelName: string;
  cumulativeXp: number;
  /** XP into current level segment — for legacy agent.xp bar sync */
  intoLevel: number;
  spanToNext: number;
} {
  const xp = Math.max(0, bot.xp);
  const level = Math.min(10, Math.max(1, bot.level));
  const minThis = getBotXpForLevel(level);

  if (level >= 10) {
    return {
      percent: 100,
      label: `${xp} XP`,
      level,
      levelName: botLevelName(level),
      cumulativeXp: xp,
      intoLevel: Math.max(0, xp - minThis),
      spanToNext: 1,
    };
  }

  const minNext = getBotXpForLevel(level + 1);
  const span = Math.max(1, minNext - minThis);
  const into = Math.min(span, Math.max(0, xp - minThis));
  const percent = Math.min(100, Math.round((into / span) * 100));

  return {
    percent,
    label: `${into}/${span}`,
    level,
    levelName: botLevelName(level),
    cumulativeXp: xp,
    intoLevel: into,
    spanToNext: span,
  };
}
