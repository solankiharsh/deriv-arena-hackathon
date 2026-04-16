'use client';

import React, { useState, useEffect } from 'react';
import { useMilesStore } from '@/lib/stores/miles-store';
import { MilesBalance, MilesProgressBar, MilesIcon } from '@/components/miles';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  TrendingUp,
  Trophy,
  Flame,
  Star,
  Calendar,
  ArrowRight,
} from 'lucide-react';
import { useArenaAuth } from '@/store/arenaAuthStore';

const ICON_MAP: Record<string, React.ReactNode> = {
  'trending-up': <TrendingUp className="w-5 h-5" />,
  'trophy': <Trophy className="w-5 h-5" />,
  'flame': <Flame className="w-5 h-5" />,
  'star': <Star className="w-5 h-5" />,
  'calendar': <Calendar className="w-5 h-5" />,
};

export default function MilesDashboardPage() {
  const { user } = useArenaAuth();
  const userId = user?.deriv_account_id ?? 'demo_user';
  const {
    stats,
    transactions,
    redemptions,
    earningOpportunities,
    loading,
    fetchStats,
    fetchTransactions,
    fetchRedemptions,
    fetchEarningOpportunities,
  } = useMilesStore();

  useEffect(() => {
    fetchStats(userId);
    fetchTransactions(userId, 10, 0);
    fetchRedemptions(userId);
    fetchEarningOpportunities(userId);
  }, [userId, fetchStats, fetchTransactions, fetchRedemptions, fetchEarningOpportunities]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Deriv Miles Dashboard</h1>
          <p className="text-muted-foreground">Track your miles, tier progress, and redemptions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-semibold">Your Miles</h2>
                <Link href="/marketplace">
                  <Button>
                    Browse Marketplace
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>

              {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Current Balance</p>
                    <p className="text-3xl font-bold flex items-center justify-center gap-2">
                      <MilesIcon size={28} className="text-yellow-500" />
                      {parseFloat(stats.current_balance).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Total Earned</p>
                    <p className="text-3xl font-bold text-green-600">
                      {parseFloat(stats.total_earned).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Total Spent</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {parseFloat(stats.total_spent).toLocaleString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="h-32 animate-pulse bg-muted rounded"></div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Tier Progress</h2>
              <MilesProgressBar userId={userId} />
              {stats && stats.tier_benefits && (
                <div className="mt-6">
                  <p className="text-sm font-medium mb-2">Current Tier Benefits:</p>
                  <ul className="space-y-1">
                    {stats.tier_benefits.map((benefit, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-green-600 mt-0.5">✓</span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Earning Opportunities</h2>
              {loading && earningOpportunities.length === 0 ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 animate-pulse bg-muted rounded-lg" />
                  ))}
                </div>
              ) : earningOpportunities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Complete trades and competitions to earn miles</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {earningOpportunities.map((opp, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                      <div className="text-primary">
                        {ICON_MAP[opp.icon] || <Star className="w-5 h-5" />}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{opp.title}</h3>
                        <p className="text-sm text-muted-foreground">{opp.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
              {transactions.length === 0 ? (
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
          </div>
        </div>
      </div>
    </div>
  );
}
