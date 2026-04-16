'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Filter, Loader2 } from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { useAuthNudge } from '@/lib/stores/auth-nudge-store';
import type { GameTemplate, GameMode } from '@/lib/arena-types';
import { GAME_MODE_LABELS } from '@/lib/arena-types';
import GameModeCard from './GameModeCard';

const MODE_FILTERS: { value: GameMode | 'all'; label: string }[] = [
  { value: 'all', label: 'All Modes' },
  { value: 'classic', label: 'Classic' },
  { value: 'phantom_league', label: 'Phantom' },
  { value: 'boxing_ring', label: 'Boxing' },
  { value: 'anti_you', label: 'Anti-You' },
  { value: 'war_room', label: 'War Room' },
  { value: 'behavioral_xray', label: 'X-Ray' },
];

export default function GameModesGrid() {
  const router = useRouter();
  const { user } = useArenaAuth();
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GameMode | 'all'>('all');
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const mode = filter === 'all' ? undefined : filter;
        const { templates: data } = await arenaApi.templates.list(mode);
        setTemplates(data);
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filter]);

  const handlePlay = async (template: GameTemplate) => {
    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[auth-nudge] blocked handlePlay', { templateId: template.id });
      }
      useAuthNudge.getState().nudge();
      return;
    }
    setCreating(template.id);
    try {
      const { instance } = await arenaApi.instances.create(template.slug);
      await arenaApi.instances.join(instance.id);
      router.push(`/play/${instance.id}`);
    } catch (err) {
      console.error('Failed to create instance:', err);
    } finally {
      setCreating(null);
    }
  };

  const isPartnerOrAdmin = user?.role === 'partner' || user?.role === 'admin';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {MODE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setLoading(true); }}
              className="flex-shrink-0 text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap"
              style={filter === f.value
                ? { color: '#E8B45E', background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
                : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {isPartnerOrAdmin && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/create')}
            className="btn-primary text-sm py-2 px-4 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            Create Template
          </motion.button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-text-muted text-sm mb-4">No game templates found</p>
          {isPartnerOrAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/create')}
              className="btn-secondary text-sm"
            >
              Create the first one
            </motion.button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((template, i) => (
            <div key={template.id} className="relative">
              {creating === template.id && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-card bg-black/60 backdrop-blur-sm">
                  <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
                </div>
              )}
              <GameModeCard
                template={template}
                onPlay={handlePlay}
                index={i}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
