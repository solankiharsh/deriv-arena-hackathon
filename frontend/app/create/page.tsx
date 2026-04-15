'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, ArrowLeft, Trophy, Ghost, Flame, Brain, Target, Zap, Clock, Users, Loader2 } from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import { useArenaAuth } from '@/store/arenaAuthStore';
import type { GameMode, GameTemplate } from '@/lib/arena-types';
import { GAME_MODE_LABELS, GAME_MODE_DESCRIPTIONS } from '@/lib/arena-types';
import GradientText from '@/components/reactbits/GradientText';

const MODE_OPTIONS: { value: GameMode; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }[] = [
  { value: 'classic', icon: Trophy, color: '#E8B45E' },
  { value: 'phantom_league', icon: Ghost, color: '#8B5CF6' },
  { value: 'boxing_ring', icon: Flame, color: '#EF4444' },
  { value: 'anti_you', icon: Brain, color: '#06B6D4' },
  { value: 'war_room', icon: Target, color: '#10B981' },
  { value: 'behavioral_xray', icon: Zap, color: '#EC4899' },
];

export default function CreateTemplatePage() {
  const router = useRouter();
  const { user, fetchUser } = useArenaAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myTemplates, setMyTemplates] = useState<GameTemplate[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [duration, setDuration] = useState(15);
  const [maxPlayers, setMaxPlayers] = useState(50);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (user) {
      arenaApi.templates.mine().then(({ templates }) => setMyTemplates(templates)).catch(() => {});
    }
  }, [user]);

  const isPartnerOrAdmin = user?.role === 'partner' || user?.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isPartnerOrAdmin) return;

    setIsSubmitting(true);
    try {
      const { template } = await arenaApi.templates.create({
        name: name.trim(),
        description: description.trim(),
        game_mode: gameMode,
        config: {
          duration_minutes: duration,
          max_players: maxPlayers,
          allowed_markets: ['R_100', 'R_50', 'R_75', 'R_10', 'R_25'],
          stake_range: [1, 100],
          contract_types: ['CALL', 'PUT', 'DIGITOVER', 'DIGITUNDER'],
        },
      });

      setMyTemplates(prev => [template, ...prev]);
      setName('');
      setDescription('');
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-4">Sign in to create game templates</p>
          <button onClick={() => router.push('/login')} className="btn-primary">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!isPartnerOrAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-display font-bold text-text-primary mb-2">
            Partner Access Required
          </h2>
          <p className="text-text-secondary text-sm mb-4">
            Only partners and admins can create game templates.
            Switch your role in settings to get started.
          </p>
          <button onClick={() => router.push('/arena')} className="btn-secondary">
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container-colosseum py-8 max-w-3xl">
        <button
          onClick={() => router.push('/arena')}
          className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Arena</span>
        </button>

        <h1 className="text-2xl font-display font-bold mb-1">
          <GradientText
            colors={['#E8B45E', '#F5C978', '#E8B45E']}
            animationSpeed={4}
            className="font-display font-bold"
          >
            Create Game Template
          </GradientText>
        </h1>
        <p className="text-text-secondary text-sm mb-8">
          Design a reusable competition template. Players will create instances from it.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Quick Fire Classic"
              className="input"
              required
              maxLength={80}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider mb-2 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what makes this competition unique..."
              className="input min-h-[80px] resize-none"
              maxLength={500}
            />
          </div>

          {/* Game Mode */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wider mb-3 block">
              Game Mode
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {MODE_OPTIONS.map(({ value, icon: Icon, color }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setGameMode(value)}
                  className={`
                    text-left p-4 rounded-card border transition-all
                    ${gameMode === value
                      ? 'border-accent-primary bg-accent-primary/5'
                      : 'border-border bg-card hover:border-border-strong'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mb-2" style={{ color }} />
                  <div className="text-sm font-display font-bold uppercase tracking-wide text-text-primary">
                    {GAME_MODE_LABELS[value]}
                  </div>
                  <p className="text-[11px] text-text-muted mt-1 line-clamp-2">
                    {GAME_MODE_DESCRIPTIONS[value]}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Duration & Max Players */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(5, parseInt(e.target.value) || 15))}
                className="input"
                min={5}
                max={120}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
                <Users className="w-3 h-3" /> Max Players
              </label>
              <input
                type="number"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Math.max(2, parseInt(e.target.value) || 50))}
                className="input"
                min={2}
                max={500}
              />
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="btn-primary w-full py-4 text-lg"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Create Template
              </>
            )}
          </motion.button>
        </form>

        {/* My Templates */}
        {myTemplates.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-display font-bold text-text-primary mb-4 uppercase tracking-wider">
              Your Templates
            </h2>
            <div className="space-y-3">
              {myTemplates.map((t) => (
                <div key={t.id} className="bg-card border border-border rounded-card p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-text-primary">{t.name}</div>
                    <div className="text-xs text-text-muted">
                      {GAME_MODE_LABELS[t.game_mode as GameMode]} · {t.play_count} plays
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/compete/${t.slug}`;
                      navigator.clipboard.writeText(url);
                    }}
                    className="btn-ghost text-xs"
                  >
                    Copy Link
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
