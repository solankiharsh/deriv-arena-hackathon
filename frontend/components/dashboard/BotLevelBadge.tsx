'use client';

import { Bot } from '@/lib/api/trading-bots';

const LEVEL_COLORS: Record<number, string> = {
  1: '#94a3b8',
  2: '#94a3b8',
  3: '#60a5fa',
  4: '#60a5fa',
  5: '#a78bfa',
  6: '#a78bfa',
  7: '#E8B45E',
  8: '#E8B45E',
  9: '#f97316',
  10: '#ff0033',
};

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500];

function xpForLevel(level: number): number {
  if (level <= 0) return 0;
  if (level > LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return LEVEL_THRESHOLDS[level - 1];
}

export function BotLevelBadge({ bot, compact = false }: { bot: Bot; compact?: boolean }) {
  const color = LEVEL_COLORS[bot.level] || '#94a3b8';
  const curXP = xpForLevel(bot.level);
  const nextXP = bot.level >= 10 ? bot.xp : xpForLevel(bot.level + 1);
  const denom = Math.max(1, nextXP - curXP);
  const progress = bot.level >= 10 ? 100 : Math.min(100, Math.max(0, ((bot.xp - curXP) / denom) * 100));

  if (compact) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase"
        style={{
          background: `${color}15`,
          border: `1px solid ${color}40`,
          color,
        }}
      >
        <span>Lv.{bot.level}</span>
        <span className="opacity-60">
          {bot.xp}/{nextXP}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-[10px] relative shrink-0"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
          boxShadow: `0 0 12px ${color}40`,
          color: 'white',
        }}
      >
        Lv.{bot.level}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider">
            XP {bot.xp.toLocaleString()}
          </span>
          <span className="text-[10px] text-white/30 font-mono">
            {bot.level < 10 ? `/${nextXP.toLocaleString()}` : 'MAX'}
          </span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-1">
          <div
            className="h-full transition-all duration-500 rounded-full"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${color} 0%, ${color}CC 100%)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
