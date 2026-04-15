'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Shield, Users, Gamepad2, TrendingUp, Trophy,
  ArrowUpRight, BarChart3, Target, Loader2, ChevronRight,
} from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import { useArenaAuth } from '@/store/arenaAuthStore';
import type { AdminStats, PartnerStats, ArenaUser } from '@/lib/arena-types';
import GradientText from '@/components/reactbits/GradientText';

function StatCard({ label, value, icon: Icon, color = 'text-accent-primary', delay = 0 }: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
  delay?: number;
}) {
  const cls = `w-5 h-5 ${color}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-card border border-border rounded-card p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <Icon className={cls} />
        <ArrowUpRight className="w-4 h-4 text-text-muted" />
      </div>
      <div className="text-2xl font-mono font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted uppercase tracking-wider mt-1">{label}</div>
    </motion.div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, fetchUser } = useArenaAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [partners, setPartners] = useState<PartnerStats[]>([]);
  const [players, setPlayers] = useState<ArenaUser[]>([]);
  const [funnel, setFunnel] = useState<Array<{ event_type: string; count: number }>>([]);
  const [dailyConversions, setDailyConversions] = useState<Array<{ day: string; count: number }>>([]);
  const [liveInstances, setLiveInstances] = useState<Array<{ id: string; template_name?: string; player_count: number; started_at: string | null }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, pl, f, live] = await Promise.all([
        arenaApi.admin.stats(),
        arenaApi.admin.partners(),
        arenaApi.admin.players(),
        arenaApi.admin.funnel(),
        arenaApi.instances.list({ status: 'live' }),
      ]);
      setStats(s);
      setPartners(p.partners);
      setPlayers(pl.players);
      setFunnel(f.funnel);
      setDailyConversions(f.daily_conversions);
      setLiveInstances(live.instances.map(inst => ({
        id: inst.id,
        template_name: inst.template?.name,
        player_count: inst.player_count,
        started_at: inst.started_at,
      })));
    } catch (err) {
      console.error('Admin load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') loadData();
  }, [user, loadData]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-text-primary mb-2">Sign In Required</h2>
          <p className="text-text-secondary text-sm mb-4">Please log in to access the admin dashboard.</p>
          <button onClick={() => router.push('/login')} className="btn-primary">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-error/50 mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-text-primary mb-2">Access Denied</h2>
          <p className="text-text-secondary text-sm mb-4">Admin privileges required.</p>
          <button onClick={() => router.push('/arena')} className="btn-secondary">
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container-colosseum py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-6 h-6 text-accent-primary" />
            <h1 className="text-2xl font-display font-bold">
              <GradientText
                colors={['#E8B45E', '#F5C978', '#D6A04B', '#E8B45E']}
                animationSpeed={4}
                className="font-display font-bold"
              >
                Admin Dashboard
              </GradientText>
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            Platform-wide analytics and management
          </p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Players" value={stats.total_players} icon={Users} delay={0} />
            <StatCard label="Total Partners" value={stats.total_partners} icon={Target} color="text-purple-400" delay={0.05} />
            <StatCard label="Game Templates" value={stats.total_templates} icon={Gamepad2} color="text-cyan-400" delay={0.1} />
            <StatCard label="Active Games" value={stats.active_instances} icon={Trophy} color="text-success" delay={0.15} />
            <StatCard label="Total Instances" value={stats.total_instances} icon={BarChart3} delay={0.2} />
            <StatCard label="Total Conversions" value={stats.total_conversions} icon={TrendingUp} color="text-success" delay={0.25} />
            <StatCard
              label="Conversion Rate"
              value={`${stats.conversion_rate.toFixed(1)}%`}
              icon={ArrowUpRight}
              color="text-accent-primary"
              delay={0.3}
            />
            <StatCard
              label="Top Partner"
              value={stats.top_partner?.name || 'N/A'}
              icon={Trophy}
              color="text-accent-primary"
              delay={0.35}
            />
          </div>
        )}

        {/* Daily Conversions Chart + Live Games */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {dailyConversions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card border border-border rounded-card p-6"
            >
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4">
                Daily Conversions (30d)
              </h2>
              <div className="flex items-end gap-1 h-28">
                {dailyConversions.map((d) => {
                  const maxC = Math.max(...dailyConversions.map(x => x.count), 1);
                  const height = Math.max(4, (d.count / maxC) * 100);
                  return (
                    <div key={d.day} className="flex-1 flex flex-col items-center justify-end group relative">
                      <div className="absolute -top-6 hidden group-hover:block bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary whitespace-nowrap z-10">
                        {d.day}: {d.count}
                      </div>
                      <div
                        className="w-full bg-accent-primary/20 border border-accent-primary/30 rounded-t transition-all group-hover:bg-accent-primary/40"
                        style={{ height: `${height}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-text-muted">{dailyConversions[0]?.day}</span>
                <span className="text-[10px] text-text-muted">{dailyConversions[dailyConversions.length - 1]?.day}</span>
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-card border border-border rounded-card p-6"
          >
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4">
              Live Games ({liveInstances.length})
            </h2>
            {liveInstances.length === 0 ? (
              <p className="text-text-muted text-sm">No games currently live</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-custom">
                {liveInstances.map((inst) => (
                  <div key={inst.id} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] rounded-lg border border-border/50">
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {inst.template_name || 'Game'}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {inst.started_at ? `Started ${new Date(inst.started_at).toLocaleTimeString()}` : 'Starting...'}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      <Users className="w-3.5 h-3.5" />
                      {inst.player_count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Conversion Funnel */}
        {funnel.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card border border-border rounded-card p-6 mb-8"
          >
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4">
              Conversion Funnel
            </h2>
            <div className="flex items-end gap-4">
              {funnel.map((step, i) => {
                const maxCount = Math.max(...funnel.map(f => f.count), 1);
                const height = Math.max(20, (step.count / maxCount) * 120);
                return (
                  <div key={step.event_type} className="flex-1 text-center">
                    <div className="text-lg font-mono font-bold text-text-primary mb-1">
                      {step.count}
                    </div>
                    <div
                      className="bg-accent-primary/20 border border-accent-primary/30 rounded-t-lg mx-auto max-w-[60px] transition-all"
                      style={{ height: `${height}px` }}
                    />
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mt-2">
                      {step.event_type.replace('_', ' ')}
                    </div>
                    {i < funnel.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-text-muted absolute -right-2 top-1/2" />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Partners Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-card p-6 mb-8"
        >
          <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4">
            Partners
          </h2>
          {partners.length === 0 ? (
            <p className="text-text-muted text-sm">No partners yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border">
                    <th className="pb-3 pr-4">Name</th>
                    <th className="pb-3 pr-4">Templates</th>
                    <th className="pb-3 pr-4">Instances</th>
                    <th className="pb-3 pr-4">Players</th>
                    <th className="pb-3 pr-4">Conversions</th>
                    <th className="pb-3">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.partner_id} className="border-b border-border/50">
                      <td className="py-3 pr-4 font-medium text-text-primary">{p.display_name}</td>
                      <td className="py-3 pr-4 font-mono">{p.templates_created}</td>
                      <td className="py-3 pr-4 font-mono">{p.total_instances}</td>
                      <td className="py-3 pr-4 font-mono">{p.total_players_reached}</td>
                      <td className="py-3 pr-4 font-mono text-success">{p.total_conversions}</td>
                      <td className="py-3 font-mono">{Number(p.conversion_rate).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Recent Players */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-card border border-border rounded-card p-6"
        >
          <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4">
            All Users ({players.length})
          </h2>
          <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-custom">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] rounded-lg">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-soft/20 to-accent-dark/20 border border-border flex items-center justify-center text-xs font-bold text-text-secondary">
                  {p.display_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{p.display_name}</div>
                  <div className="text-[10px] text-text-muted">{p.role} · {p.total_games} games</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-text-primary">
                    {Number(p.arena_rating).toFixed(1)}
                  </div>
                  <div className="text-[10px] text-text-muted">rating</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
