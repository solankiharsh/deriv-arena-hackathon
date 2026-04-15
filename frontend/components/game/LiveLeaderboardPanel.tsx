'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, TrendingDown, Crown } from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import type { InstancePlayer } from '@/lib/arena-types';

interface LiveLeaderboardPanelProps {
  instanceId: string;
  currentUserId: string;
}

export default function LiveLeaderboardPanel({ instanceId, currentUserId }: LiveLeaderboardPanelProps) {
  const [players, setPlayers] = useState<(InstancePlayer & { display_name: string; avatar_url: string | null })[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await arenaApi.instances.liveLeaderboard(instanceId);
      setPlayers(data.players);
    } catch {}
  }, [instanceId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="bg-card border border-border rounded-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-accent-primary" />
        <h3 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary">
          Live Leaderboard
        </h3>
        <span className="ml-auto text-xs text-text-muted">{players.length} players</span>
      </div>

      <div className="space-y-1.5">
        {players.map((player, i) => {
          const isMe = player.user_id === currentUserId;
          const rank = i + 1;
          return (
            <motion.div
              key={player.user_id}
              layout
              className={`
                flex items-center gap-3 px-3 py-2 rounded-lg transition-all
                ${isMe ? 'bg-accent-primary/10 border border-accent-primary/20' : 'bg-white/[0.02]'}
              `}
            >
              <span className={`
                w-6 text-center font-mono font-bold text-sm
                ${rank === 1 ? 'text-accent-primary' : rank <= 3 ? 'text-text-secondary' : 'text-text-muted'}
              `}>
                {rank === 1 ? <Crown className="w-4 h-4 text-accent-primary mx-auto" /> : rank}
              </span>

              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-soft/30 to-accent-dark/30 border border-border flex items-center justify-center text-xs font-bold text-text-secondary">
                {player.display_name?.charAt(0) || '?'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary truncate">
                  {player.display_name}
                  {isMe && <span className="text-accent-primary ml-1 text-xs">(you)</span>}
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm font-mono font-bold text-text-primary">
                  {Number(player.score).toFixed(1)}
                </div>
                <div className={`text-[10px] font-mono flex items-center gap-0.5 justify-end ${Number(player.pnl) >= 0 ? 'text-success' : 'text-error'}`}>
                  {Number(player.pnl) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  ${Math.abs(Number(player.pnl)).toFixed(2)}
                </div>
              </div>
            </motion.div>
          );
        })}

        {players.length === 0 && (
          <div className="text-center py-6 text-text-muted text-sm">
            Waiting for players...
          </div>
        )}
      </div>
    </div>
  );
}
