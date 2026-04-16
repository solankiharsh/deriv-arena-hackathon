'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  BarChart3, Users, Gamepad2, TrendingUp,
  ArrowUpRight, Target, Loader2, ChevronRight, Shield, Share2, GitBranch,
} from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { GAME_MODE_LABELS, type GameMode } from '@/lib/arena-types';
import GradientText from '@/components/reactbits/GradientText';
import ReferralJourneyTimeline from '@/components/partner/ReferralJourneyTimeline';

type JourneyData = Awaited<ReturnType<typeof arenaApi.partner.referralJourney>>;

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

interface PartnerData {
  summary: {
    templates_created: number;
    total_instances: number;
    total_players_reached: number;
    total_conversions: number;
    conversion_rate: number;
  };
  daily_conversions: Array<{ day: string; count: number }>;
  template_performance: Array<{
    template_id: string;
    template_name: string;
    game_mode: string;
    play_count: number;
    player_count: number;
    conversions: number;
  }>;
  funnel: Array<{ event_type: string; count: number }>;
  referrals?: {
    total_clicks: number;
    unique_players: number;
    by_source: Array<{ source: string; count: number }>;
  };
}

export default function PartnerDashboard() {
  const router = useRouter();
  const { user, isLoading: authLoading, fetchUser } = useArenaAuth();
  const [data, setData] = useState<PartnerData | null>(null);
  const [journeyData, setJourneyData] = useState<JourneyData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const loadData = useCallback(async () => {
    setDataLoading(true);
    setError(null);
    try {
      const [result, journey] = await Promise.all([
        arenaApi.partner.stats(),
        arenaApi.partner.referralJourney().catch(() => null),
      ]);
      setData(result);
      setJourneyData(journey);
    } catch (err) {
      console.error('Partner stats load failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load partner data');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && (user.role === 'partner' || user.role === 'admin')) {
      loadData();
    }
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
          <p className="text-text-secondary text-sm mb-4">Please log in to access the partner dashboard.</p>
          <button onClick={() => router.push('/login')} className="btn-primary">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (user.role !== 'partner' && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-error/50 mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-text-primary mb-2">Access Denied</h2>
          <p className="text-text-secondary text-sm mb-4">Partner privileges required.</p>
          <button onClick={() => router.push('/arena')} className="btn-secondary">
            Back to Arena
          </button>
        </div>
      </div>
    );
  }

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="w-12 h-12 text-error/50 mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-text-primary mb-2">Failed to Load</h2>
          <p className="text-text-secondary text-sm mb-4">{error}</p>
          <button onClick={loadData} className="btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const s = data?.summary;
  const dailyMax = Math.max(...(data?.daily_conversions.map(d => d.count) || [1]), 1);

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container-colosseum py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Target className="w-6 h-6 text-purple-400" />
            <h1 className="text-2xl font-display font-bold">
              <GradientText
                colors={['#A855F7', '#C084FC', '#9333EA', '#A855F7']}
                animationSpeed={4}
                className="font-display font-bold"
              >
                Partner Dashboard
              </GradientText>
            </h1>
          </div>
          <p className="text-text-secondary text-sm">
            Your templates, conversions, and performance analytics
          </p>
        </div>

        {/* Stats Grid */}
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard label="My Templates" value={s.templates_created} icon={Gamepad2} color="text-purple-400" delay={0} />
            <StatCard label="Total Instances" value={s.total_instances} icon={BarChart3} delay={0.05} />
            <StatCard label="Players Reached" value={s.total_players_reached} icon={Users} color="text-cyan-400" delay={0.1} />
            <StatCard label="Conversions" value={s.total_conversions} icon={TrendingUp} color="text-success" delay={0.15} />
            <StatCard label="Conversion Rate" value={`${s.conversion_rate.toFixed(1)}%`} icon={ArrowUpRight} color="text-accent-primary" delay={0.2} />
          </div>
        )}

        {/* Referral Stats */}
        {data?.referrals && data.referrals.total_clicks > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="bg-card border border-border rounded-card p-6 mb-8"
          >
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-purple-400" /> Referral Performance
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-2xl font-mono font-bold text-text-primary">{data.referrals.total_clicks}</div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Link Clicks</div>
              </div>
              <div>
                <div className="text-2xl font-mono font-bold text-text-primary">{data.referrals.unique_players}</div>
                <div className="text-xs text-text-muted uppercase tracking-wider">Unique Players</div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {data.referrals.by_source.map((s) => (
                <span key={s.source} className="text-[11px] font-mono px-3 py-1 border border-border rounded-pill text-text-muted">
                  {s.source}: <span className="text-text-primary font-bold">{s.count}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Referral Journey Timeline */}
        {journeyData && journeyData.sources.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.23 }}
            className="bg-card border border-border rounded-card p-6 mb-8"
          >
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-accent-primary" /> Referral Journey
            </h2>
            <ReferralJourneyTimeline
              sources={journeyData.sources}
              recentJourneys={journeyData.recent_journeys}
            />
          </motion.div>
        )}

        {/* Daily Conversions Chart */}
        {data && data.daily_conversions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-card border border-border rounded-card p-6 mb-8"
          >
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4">
              Daily Conversions (Last 30 Days)
            </h2>
            <div className="flex items-end gap-1 h-24 sm:h-32">
              {data.daily_conversions.map((d, i) => {
                const height = Math.max(4, (d.count / dailyMax) * 100);
                return (
                  <motion.div
                    key={d.day}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ delay: 0.3 + i * 0.02, duration: 0.3 }}
                    style={{ transformOrigin: 'bottom' }}
                    className="flex-1 flex flex-col items-center justify-end group relative"
                  >
                    <div className="absolute -top-6 hidden group-hover:block bg-bg-elevated border border-border rounded px-2 py-1 text-xs text-text-primary whitespace-nowrap z-10">
                      {d.day}: {d.count}
                    </div>
                    <div
                      className="w-full bg-purple-500/30 border border-purple-500/40 rounded-t transition-all group-hover:bg-purple-500/50"
                      style={{ height: `${height}%` }}
                    />
                  </motion.div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-[10px] text-text-muted">
                {data.daily_conversions[0]?.day}
              </span>
              <span className="text-[10px] text-text-muted">
                {data.daily_conversions[data.daily_conversions.length - 1]?.day}
              </span>
            </div>
          </motion.div>
        )}

        {/* Template Performance Table */}
        {data && data.template_performance.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card border border-border rounded-card p-6 mb-8"
          >
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4">
              Template Performance
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border">
                    <th className="pb-3 pr-4">Template</th>
                    <th className="pb-3 pr-4">Mode</th>
                    <th className="pb-3 pr-4">Games</th>
                    <th className="pb-3 pr-4">Players</th>
                    <th className="pb-3 pr-4">Conversions</th>
                    <th className="pb-3">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.template_performance.map((tp, tpIdx) => {
                    const rate = tp.player_count > 0 ? ((tp.conversions / tp.player_count) * 100).toFixed(1) : '0.0';
                    const isBest = tpIdx === 0 && tp.conversions > 0;
                    return (
                      <tr key={tp.template_id} className={`border-b border-border/50 ${isBest ? 'bg-accent-primary/[0.03]' : ''}`}>
                        <td className="py-3 pr-4 font-medium text-text-primary">{tp.template_name}</td>
                        <td className="py-3 pr-4">
                          <span className="text-[10px] font-mono px-2 py-0.5 border border-border rounded-pill text-text-muted">
                            {GAME_MODE_LABELS[tp.game_mode as GameMode] || tp.game_mode}
                          </span>
                        </td>
                        <td className="py-3 pr-4 font-mono">{tp.play_count}</td>
                        <td className="py-3 pr-4 font-mono">{tp.player_count}</td>
                        <td className="py-3 pr-4 font-mono text-success">{tp.conversions}</td>
                        <td className="py-3 font-mono">{rate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Conversion Funnel */}
        {data && data.funnel.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-card border border-border rounded-card p-6"
          >
            <h2 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary mb-4">
              Conversion Funnel
            </h2>
            <div className="flex items-end gap-4">
              {data.funnel.map((step, i) => {
                const maxCount = Math.max(...data.funnel.map(f => f.count), 1);
                const height = Math.max(20, (step.count / maxCount) * 120);
                return (
                  <div key={step.event_type} className="flex-1 text-center relative">
                    <div className="text-lg font-mono font-bold text-text-primary mb-1">
                      {step.count}
                    </div>
                    <div
                      className="bg-purple-500/20 border border-purple-500/30 rounded-t-lg mx-auto max-w-[60px] transition-all"
                      style={{ height: `${height}px` }}
                    />
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mt-2">
                      {step.event_type.replace(/_/g, ' ')}
                    </div>
                    {i < data.funnel.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-text-muted absolute -right-2 top-1/2 hidden md:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {data && data.template_performance.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-card p-12 text-center"
          >
            <Gamepad2 className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
            <h3 className="text-lg font-display font-bold text-text-primary mb-2">No Templates Yet</h3>
            <p className="text-text-secondary text-sm mb-4">Create your first game template to start tracking performance.</p>
            <button onClick={() => router.push('/create')} className="btn-primary">
              Create Template
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
