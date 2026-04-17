'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import { MessageSquare, PanelLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCopilotDB } from '@/lib/trading-copilot/copilot-db';
import type { CopilotConversationRow } from '@/lib/trading-copilot/copilot-db';

export function CopilotSidebar({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [items, setItems] = useState<CopilotConversationRow[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const db = getCopilotDB();
    const rows = await db.conversations.where('userId').equals(userId).sortBy('updatedAt');
    setItems(rows.reverse());
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh, pathname]);

  const activeId = pathname?.match(/^\/trading-copilot\/([^/]+)$/)?.[1] ?? null;

  const handleNew = useCallback(async () => {
    const id = nanoid();
    const db = getCopilotDB();
    const now = Date.now();
    await db.conversations.add({
      id,
      userId,
      title: 'New conversation',
      updatedAt: now,
    });
    setOpen(false);
    router.push(`/trading-copilot/${id}`);
  }, [router, userId]);

  const handleDelete = useCallback(
    async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const db = getCopilotDB();
      await db.messages.where('conversationId').equals(id).delete();
      await db.conversations.delete(id);
      if (activeId === id) {
        router.push('/trading-copilot');
      }
      void refresh();
    },
    [activeId, refresh, router],
  );

  return (
    <>
      <div className="lg:hidden flex items-center gap-2 border-b border-border px-3 py-2 bg-bg-secondary">
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <PanelLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm font-medium text-text-primary">Trading Copilot</span>
      </div>

      <aside
        className={`${
          open ? 'flex' : 'hidden'
        } lg:flex w-full lg:w-64 shrink-0 flex-col border-r border-border bg-bg-secondary min-h-0`}
      >
        <div className="p-3 border-b border-border flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-text-primary">
            <MessageSquare className="w-4 h-4 text-accent-primary" />
            <span className="font-semibold text-sm">Conversations</span>
          </div>
          <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => void handleNew()}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <p className="text-xs text-text-muted px-2 py-4">No saved threads yet.</p>
          ) : (
            items.map((c) => {
              const active = c.id === activeId;
              return (
                <Link
                  key={c.id}
                  href={`/trading-copilot/${c.id}`}
                  onClick={() => setOpen(false)}
                  className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                      : 'text-text-secondary hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span className="flex-1 truncate">{c.title || 'Untitled'}</span>
                  <button
                    type="button"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-error/10 text-text-muted hover:text-error"
                    aria-label="Delete conversation"
                    onClick={(e) => void handleDelete(c.id, e)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </Link>
              );
            })
          )}
        </nav>
        <div className="p-3 border-t border-border text-xs text-text-muted">
          <Link href="/marketplace" className="text-accent-primary hover:underline">
            Get more credits
          </Link>
        </div>
      </aside>
    </>
  );
}
