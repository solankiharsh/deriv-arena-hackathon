'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { getCopilotDB } from '@/lib/trading-copilot/copilot-db';

export default function TradingCopilotIndexPage() {
  const router = useRouter();
  const user = useArenaAuth((s) => s.user);
  const isHydrated = useArenaAuth((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated || !user) return;
    let cancelled = false;
    (async () => {
      const db = getCopilotDB();
      const existing = await db.conversations.where('userId').equals(user.id).sortBy('updatedAt');
      const latest = existing[existing.length - 1];
      if (cancelled) return;
      if (latest) {
        router.replace(`/trading-copilot/${latest.id}`);
        return;
      }
      const id = nanoid();
      await db.conversations.add({
        id,
        userId: user.id,
        title: 'New conversation',
        updatedAt: Date.now(),
      });
      router.replace(`/trading-copilot/${id}`);
    })();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, user, router]);

  return (
    <div className="flex flex-1 items-center justify-center text-text-muted text-sm p-8">
      Opening Trading Copilot…
    </div>
  );
}
