'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { useAuthNudge } from '@/lib/stores/auth-nudge-store';
import { CopilotSidebar } from '@/components/trading-copilot/CopilotSidebar';
import { Button } from '@/components/ui/button';

export default function TradingCopilotLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useArenaAuth((s) => s.user);
  const isHydrated = useArenaAuth((s) => s.isHydrated);
  const fetchUser = useArenaAuth((s) => s.fetchUser);
  const nudge = useAuthNudge((s) => s.nudge);
  const [entitled, setEntitled] = useState<boolean | null>(null);
  const [entitlementReason, setEntitlementReason] = useState<string | null>(null);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    if (!isHydrated || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/trading-copilot/entitlement', { credentials: 'include' });
        const data = (await res.json()) as { ok?: boolean; reason?: string };
        if (!cancelled) {
          setEntitled(!!data.ok);
          setEntitlementReason(data.ok ? null : (data.reason ?? 'unknown'));
        }
      } catch {
        if (!cancelled) {
          setEntitled(false);
          setEntitlementReason('unknown');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, user]);

  if (isHydrated && !user) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-text-muted text-center">Sign in to use Trading Copilot.</p>
        <Button onClick={() => nudge()}>Sign in</Button>
      </div>
    );
  }

  if (isHydrated && user && entitled === false) {
    const isNoDb = entitlementReason === 'no_db';
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-4 max-w-lg mx-auto text-center">
        <h1 className="text-2xl font-bold text-text-primary">Trading Copilot</h1>
        <p className="text-text-muted">
          {isNoDb
            ? 'Copilot credits require a configured database (DATABASE_URL) and applied migrations, including the Trading Copilot entitlement table.'
            : 'Redeem Trading Copilot in the Marketplace to unlock message credits and open this workspace.'}
        </p>
        {!isNoDb ? (
          <Button asChild className="bg-accent-primary text-black hover:brightness-110">
            <Link href="/marketplace">Go to Marketplace</Link>
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => router.push('/miles')}>
          Miles dashboard
        </Button>
      </div>
    );
  }

  if (!user || entitled === null) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-text-muted text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-[calc(100dvh-3.5rem)] border-t border-border">
      <CopilotSidebar userId={user.id} />
      <div className="flex-1 min-w-0 flex flex-col min-h-0">{children}</div>
    </div>
  );
}
