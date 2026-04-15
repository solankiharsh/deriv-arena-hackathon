'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Gamepad2, Trophy, Users, Clock, ArrowRight, Loader2,
  Swords, BarChart3, Zap, Plus, Activity,
  Crosshair, TrendingUp, Map, MessageSquare,
} from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { useIsMobile } from '@/hooks/useIsMobile';
import type {
  GameInstance, GameTemplate, GlobalLeaderboardEntry, GameMode,
} from '@/lib/arena-types';
import { GAME_MODE_LABELS } from '@/lib/arena-types';
import GradientText from '@/components/reactbits/GradientText';
import GameModesGrid from '@/components/arena/GameModesGrid';

const RisingLines = dynamic(
  () => import('@/components/react-bits/rising-lines'),
  { ssr: false },
);

const CommandCenterTab = dynamic(() => import('@/components/arena/tabs/CommandCenterTab'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-white/[0.03] animate-pulse rounded-card" />,
});
const PredictionsTab = dynamic(() => import('@/components/arena/tabs/PredictionsTab'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-white/[0.03] animate-pulse rounded-card" />,
});
const MapTab = dynamic(() => import('@/components/arena/tabs/MapTab'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-white/[0.03] animate-pulse rounded-card" />,
});
const DiscussionsTab = dynamic(() => import('@/components/arena/tabs/DiscussionsTab'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-white/[0.03] animate-pulse rounded-card" />,
});

const GOLD = '#E8B45E';
const BG = '#07090F';

type ArenaTab = 'games' | 'live' | 'leaderboard' | 'command_center' | 'predictions' | 'map' | 'discussions';

function LiveInstanceCard({ instance }: { instance: GameInstance & { template_name?: string; game_mode?: string } }) {
  const router = useRouter();
  const mode = (instance.game_mode || instance.template?.game_mode || 'classic') as GameMode;

  const statusColor: Record<string, string> = {
    waiting: 'text-amber-400 border-amber-400/30 bg-amber-400/10',
    live: 'text-green-400 border-green-400/30 bg-green-400/10',
    finished: 'text-text-muted border-white/10 bg-white/5',
  };

  const timeLeft = instance.ends_at
    ? Math.max(0, Math.floor((new Date(instance.ends_at).getTime() - Date.now()) / 60000))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={() => router.push(`/compete/${instance.id}`)}
      className="group cursor-pointer bg-card border border-border rounded-card p-4 hover:border-accent-primary/30 transition-all"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-display font-bold text-text-primary truncate">
            {instance.template_name || instance.template?.name || 'Game'}
          </h3>
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            {GAME_MODE_LABELS[mode] || mode}
          </span>
        </div>
        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-pill border ${statusColor[instance.status] || statusColor.finished}`}>
          {instance.status === 'live' && timeLeft !== null ? `${timeLeft}m left` : instance.status}
        </span>
      </div>

      <div className="flex items-center gap-4 text-xs text-text-muted">
        <span className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5" />
          {instance.player_count} players
        </span>
        {instance.started_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {new Date(instance.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-text-secondary group-hover:text-accent-primary transition-colors">
          {instance.status === 'waiting' ? 'Join' : instance.status === 'live' ? 'Spectate' : 'Results'}
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </motion.div>
  );
}

function LeaderboardRow({ entry, rank }: { entry: GlobalLeaderboardEntry; rank: number }) {
  const medalColors = ['text-amber-400', 'text-gray-300', 'text-amber-700'];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] transition-colors">
      <div className={`w-7 text-center font-mono font-bold text-sm ${rank <= 3 ? medalColors[rank - 1] : 'text-text-muted'}`}>
        {rank}
      </div>
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-soft/20 to-accent-dark/20 border border-border flex items-center justify-center text-xs font-bold text-text-secondary">
        {entry.display_name?.charAt(0) || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary truncate">{entry.display_name}</div>
        <div className="text-[10px] text-text-muted">{entry.games_played} games · {(entry.win_rate * 100).toFixed(0)}% win</div>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm font-bold text-accent-primary">{Number(entry.arena_rating).toFixed(0)}</div>
        <div className="text-[10px] text-text-muted">rating</div>
      </div>
    </div>
  );
}

function LiveCompetitions() {
  const [instances, setInstances] = useState<(GameInstance & { template_name?: string; game_mode?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'live' | 'waiting' | 'all'>('all');

  const load = useCallback(async () => {
    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const { instances: data } = await arenaApi.instances.list(
        status ? { status } : undefined,
      );
      setInstances(data);
    } catch (err) {
      console.error('Failed to load instances:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  const filters: { value: typeof statusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'live', label: 'Live Now' },
    { value: 'waiting', label: 'Waiting' },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setLoading(true); }}
            className="text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 transition-all cursor-pointer"
            style={statusFilter === f.value
              ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
              : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-accent-primary" />
        </div>
      ) : instances.length === 0 ? (
        <div className="text-center py-12">
          <Activity className="w-8 h-8 text-text-muted/50 mx-auto mb-3" />
          <p className="text-text-muted text-sm mb-1">No {statusFilter === 'all' ? '' : statusFilter} competitions yet</p>
          <p className="text-text-muted/60 text-xs">Go to Games and start one from a template</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {instances.map((inst) => (
            <LiveInstanceCard key={inst.id} instance={inst} />
          ))}
        </div>
      )}
    </div>
  );
}

function GlobalLeaderboard() {
  const [entries, setEntries] = useState<GlobalLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    arenaApi.leaderboard
      .global(20)
      .then((data) => setEntries(data.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-accent-primary" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <Trophy className="w-8 h-8 text-text-muted/50 mx-auto mb-3" />
        <p className="text-text-muted text-sm mb-1">No rankings yet</p>
        <p className="text-text-muted/60 text-xs">Complete a competition to appear on the leaderboard</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 max-h-[500px] overflow-y-auto scrollbar-custom">
      {entries.map((entry, i) => (
        <LeaderboardRow key={entry.user_id} entry={entry} rank={i + 1} />
      ))}
    </div>
  );
}

function QuickStats() {
  const { user } = useArenaAuth();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {[
        {
          label: 'Your Rating',
          value: user ? Number(user.arena_rating).toFixed(0) : '—',
          icon: BarChart3,
          color: 'text-accent-primary',
        },
        {
          label: 'Games Played',
          value: user ? user.total_games : '—',
          icon: Gamepad2,
          color: 'text-purple-400',
        },
        {
          label: 'Wins',
          value: user ? user.total_wins : '—',
          icon: Trophy,
          color: 'text-amber-400',
        },
        {
          label: 'Win Rate',
          value: user && user.total_games > 0
            ? `${((user.total_wins / user.total_games) * 100).toFixed(0)}%`
            : '—',
          icon: Zap,
          color: 'text-green-400',
        },
      ].map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-card p-4"
          >
            <Icon className={`w-4 h-4 ${stat.color} mb-2`} />
            <div className="text-xl font-mono font-bold text-text-primary">{stat.value}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wider mt-0.5">{stat.label}</div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function ArenaPage() {
  const [tab, setTab] = useState<ArenaTab>('games');
  const { user } = useArenaAuth();
  const isMobile = useIsMobile();

  const tabs: { value: ArenaTab; label: string; icon: React.ComponentType<{ className?: string }>; group: 'compete' | 'intel' }[] = [
    { value: 'games', label: 'Games', icon: Gamepad2, group: 'compete' },
    { value: 'live', label: 'Live', icon: Activity, group: 'compete' },
    { value: 'leaderboard', label: 'Leaderboard', icon: Trophy, group: 'compete' },
    { value: 'command_center', label: 'Command', icon: Crosshair, group: 'intel' },
    { value: 'predictions', label: 'Predictions', icon: TrendingUp, group: 'intel' },
    { value: 'map', label: 'Map', icon: Map, group: 'intel' },
    { value: 'discussions', label: 'Discuss', icon: MessageSquare, group: 'intel' },
  ];

  return (
    <>
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, background: BG }} />
      {!isMobile && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1, opacity: 0.22 }}>
          <RisingLines
            color="#E8B45E" horizonColor="#E8B45E" haloColor="#F5D78E"
            riseSpeed={0.06} riseScale={8} riseIntensity={1.0}
            flowSpeed={0.12} flowDensity={3.5} flowIntensity={0.5}
            horizonIntensity={0.7} haloIntensity={5} horizonHeight={-0.9}
            circleScale={-0.5} scale={5.5} brightness={0.95}
          />
        </div>
      )}

      <div className="min-h-screen" style={{ background: 'transparent' }}>
        <div
          className="sticky top-0 z-30 pt-16 sm:pt-[64px]"
          style={{
            background: 'rgba(7,9,15,0.82)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 px-3 sm:px-10 lg:px-20 xl:px-28 py-3">
            <h1 className="text-base font-black tracking-tight font-mono shrink-0">
              <GradientText
                colors={['#E8B45E', '#F5C978', '#D6A04B', '#E8B45E']}
                animationSpeed={4}
                className="font-mono font-black"
              >
                ARENA
              </GradientText>
            </h1>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {tabs.map((t, i) => {
                const Icon = t.icon;
                const showSep = i > 0 && tabs[i - 1].group !== t.group;
                return (
                  <React.Fragment key={t.value}>
                    {showSep && (
                      <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />
                    )}
                    <button
                      onClick={() => setTab(t.value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap"
                      style={tab === t.value
                        ? { color: GOLD, background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
                        : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }
                      }
                    >
                      <Icon className="w-3 h-3" />
                      {t.label}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {(user?.role === 'partner' || user?.role === 'admin') && (
              <Link
                href="/create"
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors shrink-0"
                style={{ color: GOLD, border: '1px solid rgba(232,180,94,0.3)' }}
              >
                <Plus className="w-3 h-3" />
                Create
              </Link>
            )}
          </div>
        </div>

        <div className="px-6 sm:px-10 lg:px-20 xl:px-28 py-6">
          {user && <QuickStats />}

          <AnimatePresence mode="wait">
            {tab === 'games' && (
              <motion.div key="games" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <GameModesGrid />
              </motion.div>
            )}
            {tab === 'live' && (
              <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LiveCompetitions />
              </motion.div>
            )}
            {tab === 'leaderboard' && (
              <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="max-w-2xl">
                  <GlobalLeaderboard />
                </div>
              </motion.div>
            )}
            {tab === 'command_center' && (
              <motion.div key="command_center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CommandCenterTab />
              </motion.div>
            )}
            {tab === 'predictions' && (
              <motion.div key="predictions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <PredictionsTab />
              </motion.div>
            )}
            {tab === 'map' && (
              <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <MapTab />
              </motion.div>
            )}
            {tab === 'discussions' && (
              <motion.div key="discussions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DiscussionsTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
