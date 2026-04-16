'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useMilesStore } from '@/lib/stores/miles-store';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { useAuthNudge } from '@/lib/stores/auth-nudge-store';
import { MilesProgressBar, MilesIcon } from '@/components/miles';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  TrendingUp,
  Trophy,
  Flame,
  Star,
  Calendar,
  ArrowRight,
  Shield,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  'trending-up': <TrendingUp className="w-5 h-5" />,
  'trophy': <Trophy className="w-5 h-5" />,
  'flame': <Flame className="w-5 h-5" />,
  'star': <Star className="w-5 h-5" />,
  'calendar': <Calendar className="w-5 h-5" />,
};

const SOURCE_META: Record<
  string,
  { label: string; icon: React.ReactNode }
> = {
  profitable_trade: { label: 'Profitable trades', icon: <TrendingUp className="w-4 h-4" /> },
  xp: { label: 'Game XP', icon: <Star className="w-4 h-4" /> },
  win_streak: { label: 'Win streaks', icon: <Flame className="w-4 h-4" /> },
  daily_login: { label: 'Daily login', icon: <Calendar className="w-4 h-4" /> },
  competition_win: { label: 'Competition wins', icon: <Trophy className="w-4 h-4" /> },
  referral: { label: 'Referrals', icon: <Star className="w-4 h-4" /> },
  manual: { label: 'Manual grants', icon: <Star className="w-4 h-4" /> },
};

interface BySourceEntry {
  source_type: string;
  event_count: number;
  miles: number;
  xp: number;
}

interface BreakdownResponse {
  total_xp: number;
  total_miles: number;
  total_earned_miles: number;
  tier: string;
  by_source: BySourceEntry[];
  current_streak: number;
  best_streak: number;
  daily_login_today: boolean;
}

export default function MilesDashboardPage() {
  const user = useArenaAuth((s) => s.user);
  const isHydrated = useArenaAuth((s) => s.isHydrated);
  const nudge = useAuthNudge((s) => s.nudge);
  const userId = user?.id ?? null;

  const {
    stats,
    transactions,
    redemptions,
    earningOpportunities,
    fetchStats,
    fetchTransactions,
    fetchRedemptions,
    fetchEarningOpportunities,
  } = useMilesStore();

  const [breakdown, setBreakdown] = useState<BreakdownResponse | null>(null);
  const [breakdownError, setBreakdownError] = useState<string | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const fetchBreakdown = useCallback(async () => {
    setBreakdownLoading(true);
    setBreakdownError(null);
    try {
      const res = await fetch('/api/miles/breakdown', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 401) {
        setBreakdown(null);
        return;
      }
      if (!res.ok) {
        throw new Error(`Breakdown fetch failed: ${res.status}`);
      }
      const data = (await res.json()) as BreakdownResponse;
      setBreakdown(data);
    } catch (err) {
      setBreakdownError((err as Error).message);
    } finally {
      setBreakdownLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchStats(userId);
    fetchTransactions(userId, 10, 0);
    fetchRedemptions(userId);
    fetchEarningOpportunities(userId);
    fetchBreakdown();
  }, [
    userId,
    fetchStats,
    fetchTransactions,
    fetchRedemptions,
    fetchEarningOpportunities,
    fetchBreakdown,
  ]);

  const derivedMiles = useMemo(() => {
    if (!breakdown) return 0;
    return Math.floor(breakdown.total_xp / 10);
  }, [breakdown]);

  if (isHydrated && !user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
          <Shield className="w-10 h-10 text-accent-primary" />
          <h1 className="text-3xl font-bold">Sign in to view your Miles</h1>
          <p className="text-muted-foreground max-w-md">
            Your XP pool, miles balance and earning history are tied to your account.
            Sign in to start earning from trades, streaks and daily logins.
          </p>
          <Button onClick={() => nudge()}>Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Deriv Miles Dashboard</h1>
          <p className="text-muted-foreground">
            One XP pool. Miles are derived at a fixed 10 XP = 1 mile ratio.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Your XP Pool</h2>
                <Link href="/marketplace">
                  <Button>
                    Browse Marketplace
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>

              {breakdown ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">Total XP</p>
                      <p className="text-3xl font-bold">
                        {breakdown.total_xp.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Miles (XP / 10)
                      </p>
                      <p className="text-3xl font-bold flex items-center justify-center gap-2">
                        <MilesIcon size={24} className="text-yellow-500" />
                        {derivedMiles.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">
                        Balance (spendable)
                      </p>
                      <p className="text-3xl font-bold text-green-600">
                        {breakdown.total_miles.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <p className="text-sm font-medium mb-3 text-muted-foreground">
                      XP earned by source
                    </p>
                    {breakdown.by_source.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No earnings yet. Play a game, login daily or land a profitable trade to start earning XP.
                      </p>
                    ) : (
                      <div className="space-y-2 font-mono text-sm">
                        {breakdown.by_source.map((entry) => {
                          const meta = SOURCE_META[entry.source_type] ?? {
                            label: entry.source_type,
                            icon: <Star className="w-4 h-4" />,
                          };
                          return (
                            <div
                              key={entry.source_type}
                              className="flex items-center justify-between py-1"
                            >
                              <div className="flex items-center gap-2 text-muted-foreground">
                                {meta.icon}
                                <span>{meta.label}</span>
                                <span className="text-xs opacity-60">
                                  ({entry.event_count} events)
                                </span>
                              </div>
                              <span className="text-foreground">
                                {entry.xp.toLocaleString()} XP
                              </span>
                            </div>
                          );
                        })}
                        <div className="flex items-center justify-between border-t border-border pt-2 mt-2 font-semibold">
                          <span>Total XP</span>
                          <span>{breakdown.total_xp.toLocaleString()} XP</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Miles = {breakdown.total_xp.toLocaleString()} / 10
                          </span>
                          <span className="text-accent-primary">
                            {derivedMiles.toLocaleString()} miles
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : breakdownError ? (
                <p className="text-sm text-red-500">Failed to load breakdown: {breakdownError}</p>
              ) : (
                <div className="h-48 animate-pulse bg-muted rounded"></div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Tier Progress</h2>
              {userId && <MilesProgressBar userId={userId} />}
              {stats && stats.tier_benefits && (
                <div className="mt-6">
                  <p className="text-sm font-medium mb-2">Current Tier Benefits:</p>
                  <ul className="space-y-1">
                    {stats.tier_benefits.map((benefit, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">+</span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Earning Opportunities</h2>
              <div className="space-y-3">
                {earningOpportunities.map((opp, i) => {
                  const isDailyLogin = opp.type === 'daily_login';
                  const isWinStreak = opp.type === 'win_streak';
                  const claimedToday = isDailyLogin && breakdown?.daily_login_today;
                  const streak = breakdown?.current_streak ?? 0;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                    >
                      <div className="text-primary">
                        {ICON_MAP[opp.icon] || <Star className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium">{opp.title}</h3>
                          {claimedToday && (
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 border border-green-500/30">
                              Claimed today
                            </span>
                          )}
                          {isWinStreak && (
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 border border-orange-500/30">
                              Streak {streak}/10
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{opp.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
              {breakdownLoading && transactions.length === 0 ? (
                <div className="h-32 animate-pulse bg-muted rounded"></div>
              ) : transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No transactions yet
                </p>
              ) : (
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((txn) => (
                    <div key={txn.id} className="flex items-start justify-between pb-3 border-b border-border last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className={`text-sm font-semibold flex items-center gap-1 ${
                        txn.transaction_type === 'earn' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {txn.transaction_type === 'earn' ? '+' : ''}
                        {parseFloat(txn.amount).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {transactions.length > 5 && (
                <Button variant="outline" className="w-full mt-4">
                  View All Transactions
                </Button>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Redemptions</h2>
              {redemptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No redemptions yet
                </p>
              ) : (
                <div className="space-y-3">
                  {redemptions.slice(0, 3).map((redemption) => (
                    <div key={redemption.id} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-start justify-between mb-1">
                        <p className="text-sm font-medium">{redemption.item_id}</p>
                        <span className={`text-xs px-2 py-1 rounded ${
                          redemption.status === 'fulfilled' ? 'bg-green-100 text-green-700' :
                          redemption.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {redemption.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {new Date(redemption.created_at).toLocaleDateString()}
                        </p>
                        <p className="text-xs font-medium">
                          {parseFloat(redemption.miles_cost).toLocaleString()} miles
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {breakdown && (
              <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-2">Streak</h2>
                <p className="text-sm text-muted-foreground mb-2">
                  Current: <span className="font-semibold text-foreground">{breakdown.current_streak}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Best: <span className="font-semibold text-foreground">{breakdown.best_streak}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Hit 5 wins for 1,000 XP, 10 wins for 2,500 XP.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
