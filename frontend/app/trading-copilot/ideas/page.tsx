'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { Lightbulb, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { getCopilotDB } from '@/lib/trading-copilot/copilot-db';
import {
  COPILOT_IDEA_CATEGORIES,
  type CopilotIdeaCategory,
  ideasForCategory,
} from '@/lib/trading-copilot/copilot-ideas';

const TAB_LABELS: Record<CopilotIdeaCategory, string> = {
  all: 'All',
  charts: 'Charts',
  signals: 'Signals',
  analysis: 'Analysis',
  trading: 'Trading',
  learning: 'Learning',
};

export default function TradingCopilotIdeasPage() {
  const router = useRouter();
  const user = useArenaAuth((s) => s.user);
  const [tab, setTab] = useState<CopilotIdeaCategory>('all');

  const ideas = useMemo(() => ideasForCategory(tab), [tab]);

  const startWithIdea = async (prompt: string) => {
    if (!user) return;
    const id = nanoid();
    const db = getCopilotDB();
    const now = Date.now();
    await db.conversations.add({
      id,
      userId: user.id,
      title: 'New conversation',
      updatedAt: now,
    });
    const q = encodeURIComponent(prompt);
    router.push(`/trading-copilot/${id}?seed=${q}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-bg-primary overflow-y-auto">
      <div className="border-b border-border px-4 py-3 flex flex-wrap items-center gap-3 max-w-5xl mx-auto w-full">
        <Button variant="ghost" size="sm" asChild className="gap-1.5 text-text-secondary">
          <Link href="/trading-copilot">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-2 text-text-primary">
          <Lightbulb className="w-5 h-5 text-accent-primary" />
          <h1 className="text-lg font-semibold">Ideas</h1>
        </div>
        <p className="text-xs text-text-muted w-full sm:w-auto sm:flex-1 sm:ml-2">
          Starter prompts open a new thread and run automatically. Requires{' '}
          <code className="text-accent-primary/90">OPENAI_API_KEY</code> in{' '}
          <code className="text-accent-primary/90">.env.local</code>.
        </p>
      </div>

      <div className="sticky top-0 z-10 border-b border-border bg-bg-primary/95 backdrop-blur px-4 py-2 max-w-5xl mx-auto w-full">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {COPILOT_IDEA_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === c
                  ? 'bg-accent-primary text-black'
                  : 'bg-bg-secondary text-text-secondary hover:text-text-primary border border-border'
              }`}
            >
              {TAB_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-5xl mx-auto w-full">
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 space-y-3">
          {ideas.map((idea) => (
            <button
              key={idea.id}
              type="button"
              onClick={() => void startWithIdea(idea.prompt)}
              className="break-inside-avoid w-full text-left rounded-xl border border-border bg-card hover:border-accent-primary/40 hover:bg-accent-primary/5 transition-colors p-4 mb-3 flex flex-col gap-2"
            >
              <div className="flex flex-wrap gap-1">
                {(idea.badges ?? [TAB_LABELS[idea.category]]).map((b) => (
                  <span
                    key={b}
                    className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-bg-secondary text-text-muted border border-border"
                  >
                    {b}
                  </span>
                ))}
              </div>
              <h2 className="text-sm font-semibold text-text-primary leading-snug">{idea.title}</h2>
              <p className="text-xs text-text-muted leading-relaxed">{idea.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
