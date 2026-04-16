'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Users, Clock, Trophy, Zap, Target, Brain, Swords, Ghost, Flame } from 'lucide-react';
import type { GameMode, GameTemplate } from '@/lib/arena-types';
import { GAME_MODE_LABELS, GAME_MODE_DESCRIPTIONS } from '@/lib/arena-types';

type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const MODE_ICONS: Record<GameMode, IconComponent> = {
  classic: Trophy,
  phantom_league: Ghost,
  boxing_ring: Flame,
  anti_you: Brain,
  war_room: Target,
  behavioral_xray: Zap,
};

const MODE_COLORS: Record<GameMode, { gradient: string; glow: string; border: string }> = {
  classic: {
    gradient: 'from-amber-500/20 to-yellow-500/5',
    glow: 'rgba(232, 180, 94, 0.15)',
    border: 'rgba(232, 180, 94, 0.25)',
  },
  phantom_league: {
    gradient: 'from-purple-500/20 to-indigo-500/5',
    glow: 'rgba(139, 92, 246, 0.15)',
    border: 'rgba(139, 92, 246, 0.25)',
  },
  boxing_ring: {
    gradient: 'from-red-500/20 to-orange-500/5',
    glow: 'rgba(239, 68, 68, 0.15)',
    border: 'rgba(239, 68, 68, 0.25)',
  },
  anti_you: {
    gradient: 'from-cyan-500/20 to-teal-500/5',
    glow: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.25)',
  },
  war_room: {
    gradient: 'from-emerald-500/20 to-green-500/5',
    glow: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.25)',
  },
  behavioral_xray: {
    gradient: 'from-pink-500/20 to-rose-500/5',
    glow: 'rgba(236, 72, 153, 0.15)',
    border: 'rgba(236, 72, 153, 0.25)',
  },
};

interface GameModeCardProps {
  template: GameTemplate;
  onPlay: (template: GameTemplate) => void;
  index?: number;
}

export default function GameModeCard({ template, onPlay, index = 0 }: GameModeCardProps) {
  const mode = template.game_mode as GameMode;
  const Icon = MODE_ICONS[mode] || Swords;
  const colors = MODE_COLORS[mode] || MODE_COLORS.classic;
  const config = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onClick={() => onPlay(template)}
      className="group cursor-pointer relative overflow-hidden rounded-card"
      style={{ border: `1px solid ${colors.border}` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-60 group-hover:opacity-100 transition-opacity duration-300`} />

      <div className="absolute inset-0 bg-card" />
      <div className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: colors.glow, border: `1px solid ${colors.border}` }}
          >
            <Icon className="w-6 h-6" style={{ color: colors.border.replace('0.25', '0.9') }} />
          </div>
          {template.is_featured && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-pill bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
              Featured
            </span>
          )}
        </div>

        <h3 className="text-lg font-display font-bold text-text-primary mb-1 uppercase tracking-wide">
          {template.name}
        </h3>
        <p className="text-sm text-text-secondary mb-4 line-clamp-2">
          {template.description || GAME_MODE_DESCRIPTIONS[mode]}
        </p>

        <div className="flex items-center gap-3 mb-4 text-xs text-text-muted">
          {config.duration_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {config.duration_minutes}m
            </span>
          )}
          {config.max_players && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {config.max_players} max
            </span>
          )}
          <span className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            {template.play_count} plays
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            {GAME_MODE_LABELS[mode]}
          </span>
          <span className="flex items-center gap-1 text-sm font-medium text-text-secondary group-hover:text-text-primary transition-colors">
            Play
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </motion.div>
  );
}
