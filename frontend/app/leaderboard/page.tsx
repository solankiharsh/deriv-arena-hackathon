'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Crown, TrendingUp, Medal, Star, Users } from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import type { GlobalLeaderboardEntry, GameMode } from '@/lib/arena-types';
import { GAME_MODE_LABELS } from '@/lib/arena-types';
import GradientText from '@/components/reactbits/GradientText';

const TABS: { value: GameMode | 'global'; label: string }[] = [
  { value: 'global', label: 'Arena Rating' },
  { value: 'classic', label: 'Classic' },
  { value: 'phantom_league', label: 'Phantom' },
  { value: 'boxing_ring', label: 'Boxing' },
  { value: 'anti_you', label: 'Anti-You' },
  { value: 'war_room', label: 'War Room' },
  { value: 'behavioral_xray', label: 'X-Ray' },
];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="w-5 h-5 text-accent-primary" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-700" />;
  return <span className="w-5 text-center font-mono font-bold text-sm text-text-muted">{rank}</span>;
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<GameMode | 'global'>('global');
  const [entries, setEntries] = useState<GlobalLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetch = tab === 'global'
      ? arenaApi.leaderboard.global(100)
      : arenaApi.leaderboard.byMode(tab, 100);

    fetch
      .then(({ entries: data }) => setEntries(data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container-colosseum py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="w-6 h-6 text-accent-primary" />
            <h1 className="text-2xl font-display font-bold">
              <GradientText
                colors={['#E8B45E', '#F5C978', '#D6A04B', '#E8B45E']}
                animationSpeed={4}
                className="font-display font-bold"
              >
                Leaderboard
              </GradientText>
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            {tab === 'global'
              ? 'Normalized Arena Rating across all game modes (0-100 scale)'
              : `Top performers in ${GAME_MODE_LABELS[tab]} mode`
            }
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-4 mb-6">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className="flex-shrink-0 text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap"
              style={tab === t.value
                ? { color: '#E8B45E', background: 'rgba(232,180,94,0.08)', border: '1px solid rgba(232,180,94,0.2)' }
                : { color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.07)' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <Star className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
            <p className="text-text-muted">No rankings yet. Start playing to appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Top 3 podium */}
            {entries.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[entries[1], entries[0], entries[2]].map((entry, idx) => {
                  const podiumRank = [2, 1, 3][idx];
                  const isFirst = podiumRank === 1;
                  return (
                    <motion.div
                      key={entry.user_id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className={`
                        text-center p-4 rounded-card border transition-all
                        ${isFirst
                          ? 'bg-accent-primary/5 border-accent-primary/20 shadow-glow-gold -mt-4'
                          : 'bg-card border-border'
                        }
                      `}
                    >
                      <div className={`
                        w-14 h-14 mx-auto rounded-full flex items-center justify-center text-lg font-bold mb-2
                        ${isFirst
                          ? 'bg-gradient-to-br from-accent-soft to-accent-dark text-black'
                          : 'bg-white/[0.05] border border-border text-text-secondary'
                        }
                      `}>
                        {entry.display_name?.charAt(0) || '?'}
                      </div>
                      <RankBadge rank={podiumRank} />
                      <div className="text-sm font-medium text-text-primary mt-1 truncate">
                        {entry.display_name}
                      </div>
                      <div className={`text-lg font-mono font-bold mt-1 ${isFirst ? 'text-accent-primary' : 'text-text-secondary'}`}>
                        {Number(entry.score).toFixed(1)}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {entry.games_played} games
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Rest of the list */}
            {entries.slice(3).map((entry, i) => (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.02 }}
                className="flex items-center gap-4 px-4 py-3 bg-card border border-border rounded-xl hover:border-border-strong transition-all"
              >
                <RankBadge rank={entry.rank} />

                <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-border flex items-center justify-center text-sm font-bold text-text-secondary">
                  {entry.display_name?.charAt(0) || '?'}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">
                    {entry.display_name}
                  </div>
                  <div className="text-[10px] text-text-muted flex items-center gap-2">
                    <span>{entry.games_played} games</span>
                    <span className="flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" />
                      {Number(entry.win_rate).toFixed(0)}% win
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-text-primary">
                    {Number(entry.score).toFixed(1)}
                  </div>
                  {entry.role === 'partner' && (
                    <div className="text-[9px] font-mono text-accent-primary uppercase">Partner</div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
