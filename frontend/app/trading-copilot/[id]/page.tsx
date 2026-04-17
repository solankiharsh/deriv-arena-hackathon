'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { CopilotChatView } from '@/components/trading-copilot/CopilotChatView';
import { getCopilotDB } from '@/lib/trading-copilot/copilot-db';
import type { CopilotMessage } from '@/lib/trading-copilot/types';

function TradingCopilotConversationInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params?.id === 'string' ? params.id : '';
const seedPrompt = searchParams?.get('seed') ?? null;
  const user = useArenaAuth((s) => s.user);
  const [initial, setInitial] = useState<CopilotMessage[] | null>(null);

  useEffect(() => {
    if (!user || !id) return;
    let cancelled = false;
    (async () => {
      const db = getCopilotDB();
      const rows = await db.messages
        .where('conversationId')
        .equals(id)
        .filter((r) => r.userId === user.id)
        .sortBy('createdAt');
      if (cancelled) return;
      const msgs: CopilotMessage[] = rows.map((r) => ({
        id: r.id,
        role: r.role,
        parts: JSON.parse(r.partsJson) as CopilotMessage['parts'],
      }));
      setInitial(msgs);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (!user || !id) {
    return null;
  }

  if (initial === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-muted text-sm">
        Loading conversation…
      </div>
    );
  }

  return (
    <CopilotChatView
      conversationId={id}
      userId={user.id}
      initialMessages={initial}
      autoSendPrompt={seedPrompt}
    />
  );
}

export default function TradingCopilotConversationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-text-muted text-sm">
          Loading conversation…
        </div>
      }
    >
      <TradingCopilotConversationInner />
    </Suspense>
  );
}
