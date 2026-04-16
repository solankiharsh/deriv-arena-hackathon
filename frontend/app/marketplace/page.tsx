'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMilesStore } from '@/lib/stores/miles-store';
import { MilesIcon } from '@/components/miles';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { useAuthNudge } from '@/lib/stores/auth-nudge-store';
import { Shield, Lock, Check } from 'lucide-react';

interface MarketplaceOption {
  label: string;
  miles: number;
}

interface MarketplaceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  isAvailable: boolean;
  options?: MarketplaceOption[];
  miles?: number;
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: 'ai_chart_analyst',
    title: 'AI Chart Analyst',
    description:
      'Generate AI-powered chart analysis and trade setups. Upload a chart to get entry, SL & TP suggestions.',
    icon: '🤖',
    isAvailable: true,
    options: [
      { label: '5 AI Credits', miles: 500 },
      { label: '20 AI Credits', miles: 1800 },
    ],
  },
  {
    id: 'pro_trading_signals',
    title: 'Pro Trading Signals',
    description:
      '7 days of curated Forex, Crypto & Indices signals with entry and exit points.',
    icon: '📡',
    isAvailable: true,
    miles: 1200,
  },
  {
    id: 'trading_journal_pro',
    title: 'Trading Journal Pro',
    description: 'Advanced journaling with P&L analytics & win rate tracker',
    icon: '📊',
    isAvailable: false,
  },
  {
    id: 'masterclass_access',
    title: 'Masterclass Access',
    description: 'Unlock 1 premium trading course from expert traders',
    icon: '🎓',
    isAvailable: false,
  },
  {
    id: 'risk_calculator',
    title: 'Risk Calculator Tool',
    description: 'Auto position sizing based on your account balance & risk %',
    icon: '🛡️',
    isAvailable: false,
  },
  {
    id: 'economic_calendar_pro',
    title: 'Economic Calendar Pro',
    description: 'High-impact event alerts with AI impact predictions',
    icon: '🌐',
    isAvailable: false,
  },
  {
    id: 'trade_copy_pass',
    title: 'Trade Copy Pass (1 Month)',
    description: 'Copy top traders on the platform automatically',
    icon: '💬',
    isAvailable: false,
  },
  {
    id: 'custom_chart_themes',
    title: 'Custom Chart Themes',
    description: 'Premium dark & pro themes for your trading charts',
    icon: '🎨',
    isAvailable: false,
  },
  {
    id: 'trading_mentor',
    title: '1-on-1 Trading Mentor (30 min)',
    description: 'Book a session with a verified Deriv trading mentor',
    icon: '🤝',
    isAvailable: false,
  },
];

const AVAILABLE_ITEMS = MARKETPLACE_ITEMS.filter((i) => i.isAvailable);
const COMING_SOON_ITEMS = MARKETPLACE_ITEMS.filter((i) => !i.isAvailable);

export default function MarketplacePage() {
  const user = useArenaAuth((s) => s.user);
  const isHydrated = useArenaAuth((s) => s.isHydrated);
  const nudge = useAuthNudge((s) => s.nudge);
  const userId = user?.id ?? null;

  const { balance, fetchBalance, redeemItem } = useMilesStore();

  const [redeemed, setRedeemed] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingItem, setPendingItem] = useState<{ item: MarketplaceItem; option?: MarketplaceOption } | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  useEffect(() => {
    if (userId) fetchBalance(userId);
  }, [userId, fetchBalance]);

  const currentBalance = balance ? parseFloat(balance.current_balance) : 0;

  const openRedeem = useCallback(
    (item: MarketplaceItem, option?: MarketplaceOption) => {
      const cost = option?.miles ?? item.miles ?? 0;
      if (currentBalance < cost) {
        toast.error('You need more miles to redeem this');
        return;
      }
      setPendingItem({ item, option });
      setModalOpen(true);
    },
    [currentBalance],
  );

  const confirmRedeem = useCallback(async () => {
    if (!pendingItem || !userId) return;
    const cost = pendingItem.option?.miles ?? pendingItem.item.miles ?? 0;
    setIsRedeeming(true);
    try {
      await redeemItem(userId, pendingItem.item.id, 1, {
        option: pendingItem.option?.label,
      });
      toast.success('Redeemed! Check your account.');
      const key = pendingItem.option
        ? `${pendingItem.item.id}_${pendingItem.option.label}`
        : pendingItem.item.id;
      setRedeemed((prev) => new Set(prev).add(key));
      setModalOpen(false);
      setPendingItem(null);
      fetchBalance(userId);
    } catch (err) {
      toast.error((err as Error).message || 'Redemption failed');
    } finally {
      setIsRedeeming(false);
    }
  }, [pendingItem, userId, redeemItem, fetchBalance]);

  const pendingCost = pendingItem
    ? (pendingItem.option?.miles ?? pendingItem.item.miles ?? 0)
    : 0;
  const canAfford = currentBalance >= pendingCost;

  if (isHydrated && !user) {
    return (
      <div className="min-h-screen bg-bg-primary">
        <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center gap-4">
          <Shield className="w-10 h-10 text-accent-primary" />
          <h1 className="text-3xl font-bold">Sign in to browse the Marketplace</h1>
          <p className="text-text-muted max-w-md">
            Earn Deriv Miles by playing games, then spend them here on trading
            tools and premium features.
          </p>
          <Button onClick={() => nudge()}>Sign in</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl font-bold mb-1">Marketplace</h1>
            <p className="text-text-muted">Redeem your miles for trading tools</p>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-5 py-3">
            <MilesIcon size={22} className="text-accent-primary" />
            <span className="text-2xl font-bold text-text-primary font-mono">
              {currentBalance.toLocaleString()}
            </span>
            <span className="text-text-muted text-sm">miles</span>
          </div>
        </div>

        {/* Available Now */}
        <div className="flex items-center gap-2 mb-5">
          <span className="w-2.5 h-2.5 rounded-full bg-success" />
          <h2 className="text-xl font-semibold">Available Now</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          {AVAILABLE_ITEMS.map((item) => (
            <div
              key={item.id}
              className="bg-card border border-border border-l-2 border-l-success rounded-xl p-6 transition-all hover:border-success/40 hover:shadow-[0_0_20px_rgba(0,255,65,0.05)]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">
                      {item.title}
                    </h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-success/10 border border-success/20 text-success">
                      Available
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-text-secondary mb-5 leading-relaxed">
                {item.description}
              </p>

              {item.options ? (
                <div className="space-y-2">
                  {item.options.map((opt) => {
                    const key = `${item.id}_${opt.label}`;
                    const isRedeemed = redeemed.has(key);
                    const notEnough = currentBalance < opt.miles;
                    return (
                      <div
                        key={opt.label}
                        className="flex items-center justify-between bg-white/[0.03] border border-border-subtle rounded-lg px-4 py-3"
                      >
                        <div>
                          <span className="text-sm font-medium text-text-primary">
                            {opt.label}
                          </span>
                          <span className="ml-3 text-sm text-accent-primary font-mono">
                            {opt.miles.toLocaleString()} miles
                          </span>
                        </div>
                        {isRedeemed ? (
                          <Button disabled size="sm" className="bg-success/20 text-success border-success/30 gap-1">
                            <Check className="w-3 h-3" /> Redeemed
                          </Button>
                        ) : notEnough ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-error border-error/30 hover:bg-error/10"
                            onClick={() => toast.error('You need more miles to redeem this')}
                          >
                            Not Enough Miles
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => openRedeem(item, opt)}
                            className="bg-accent-primary text-black hover:brightness-110"
                          >
                            Redeem
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold text-accent-primary font-mono flex items-center gap-1.5">
                    <MilesIcon size={18} className="text-accent-primary" />
                    {(item.miles ?? 0).toLocaleString()} miles
                  </span>
                  {redeemed.has(item.id) ? (
                    <Button disabled className="bg-success/20 text-success border-success/30 gap-1">
                      <Check className="w-3.5 h-3.5" /> Redeemed
                    </Button>
                  ) : currentBalance < (item.miles ?? 0) ? (
                    <Button
                      variant="outline"
                      className="text-error border-error/30 hover:bg-error/10"
                      onClick={() => toast.error('You need more miles to redeem this')}
                    >
                      Not Enough Miles
                    </Button>
                  ) : (
                    <Button
                      onClick={() => openRedeem(item)}
                      className="bg-accent-primary text-black hover:brightness-110"
                    >
                      Redeem
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Coming Soon */}
        <div className="flex items-center gap-2 mb-5">
          <Lock className="w-4 h-4 text-text-muted" />
          <h2 className="text-xl font-semibold text-text-muted">Coming Soon</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {COMING_SOON_ITEMS.map((item) => (
            <div
              key={item.id}
              className="relative bg-bg-secondary border border-border rounded-xl p-5 opacity-50 select-none"
            >
              <Lock className="absolute top-4 right-4 w-4 h-4 text-text-muted" />
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl grayscale">{item.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">
                    {item.title}
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-white/5 border border-border-subtle text-text-muted">
                    Coming Soon
                  </span>
                </div>
              </div>
              <p className="text-xs text-text-muted mb-4 leading-relaxed">
                {item.description}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-mono">
                  ——— miles
                </span>
                <Button disabled size="sm" variant="outline" className="opacity-50">
                  Locked
                </Button>
              </div>
            </div>
          ))}
        </div>

        {MARKETPLACE_ITEMS.length === 0 && (
          <div className="text-center py-20">
            <p className="text-text-muted text-lg">
              No features available right now. Keep earning miles!
            </p>
          </div>
        )}
      </div>

      {/* Redeem Confirmation Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Review the details below before confirming
            </DialogDescription>
          </DialogHeader>

          {pendingItem && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{pendingItem.item.icon}</span>
                <div>
                  <h3 className="font-semibold text-text-primary">
                    {pendingItem.item.title}
                  </h3>
                  {pendingItem.option && (
                    <p className="text-sm text-text-secondary">
                      {pendingItem.option.label}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Cost</span>
                  <span className="flex items-center gap-1 font-mono font-semibold text-accent-primary">
                    <MilesIcon size={16} className="text-accent-primary" />
                    {pendingCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Current balance</span>
                  <span className="font-mono text-text-primary">
                    {currentBalance.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-semibold border-t border-border pt-2">
                  <span className="text-text-primary">New balance</span>
                  <span className={`font-mono ${canAfford ? 'text-success' : 'text-error'}`}>
                    {(currentBalance - pendingCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmRedeem}
              disabled={!canAfford || isRedeeming}
              className="bg-accent-primary text-black hover:brightness-110"
            >
              {isRedeeming ? 'Redeeming...' : 'Confirm Redeem'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
