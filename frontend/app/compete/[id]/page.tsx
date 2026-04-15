'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Play, Users, Clock, Trophy } from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import { useArenaAuth } from '@/store/arenaAuthStore';
import type { GameTemplate, GameInstance, GameMode } from '@/lib/arena-types';
import { GAME_MODE_LABELS } from '@/lib/arena-types';
import GradientText from '@/components/reactbits/GradientText';

export default function CompetePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = (params?.id ?? '') as string;
  const { user, fetchUser } = useArenaAuth();

  const referral = useMemo(() => {
    const ref = searchParams?.get('ref');
    const src = searchParams?.get('utm_source');
    if (!ref) return undefined;
    return { referred_by: ref, source: src || 'direct' };
  }, [searchParams]);

  const [template, setTemplate] = useState<GameTemplate | null>(null);
  const [instances, setInstances] = useState<GameInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  useEffect(() => {
    arenaApi.templates.get(slug)
      .then(({ template: t, instances: i }) => {
        setTemplate(t);
        setInstances(i);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  const handleQuickPlay = async () => {
    setJoining(true);
    try {
      const waitingInstance = instances.find(i => i.status === 'waiting' || i.status === 'live');
      if (waitingInstance) {
        await arenaApi.instances.join(waitingInstance.id, referral);
        router.push(`/play/${waitingInstance.id}`);
      } else {
        const { instance } = await arenaApi.instances.create(slug);
        await arenaApi.instances.join(instance.id, referral);
        router.push(`/play/${instance.id}`);
      }
    } catch (err) {
      console.error('Failed to join:', err);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-text-muted mb-4">Competition not found</p>
          <button onClick={() => router.push('/arena')} className="btn-secondary">
            Browse Arena
          </button>
        </div>
      </div>
    );
  }

  const config = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;
  const liveInstances = instances.filter(i => i.status === 'live' || i.status === 'waiting');

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container-colosseum py-12 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <span className="text-[10px] font-mono text-accent-primary uppercase tracking-wider mb-2 inline-block">
            {GAME_MODE_LABELS[template.game_mode as GameMode]}
          </span>

          <h1 className="text-2xl sm:text-3xl font-display font-bold mb-3">
            <GradientText
              colors={['#E8B45E', '#F5C978', '#D6A04B', '#E8B45E']}
              animationSpeed={4}
              className="font-display font-bold"
            >
              {template.name}
            </GradientText>
          </h1>

          {template.description && (
            <p className="text-text-secondary mb-6 max-w-md mx-auto">
              {template.description}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mb-8 text-sm text-text-muted">
            {config.duration_minutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> {config.duration_minutes} min
              </span>
            )}
            {config.max_players && (
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" /> up to {config.max_players}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4" /> {template.play_count} plays
            </span>
          </div>

          {template.creator_name && (
            <p className="text-xs text-text-muted mb-6">
              Created by <span className="text-text-secondary">{template.creator_name}</span>
            </p>
          )}

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleQuickPlay}
            disabled={joining}
            className="btn-primary py-4 px-8 text-lg gap-2 mx-auto"
          >
            {joining ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5" />
                {liveInstances.length > 0 ? 'Join Live Game' : 'Start Playing'}
              </>
            )}
          </motion.button>

          {liveInstances.length > 0 && (
            <p className="text-xs text-success mt-3 flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              {liveInstances.length} active game{liveInstances.length > 1 ? 's' : ''}
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
