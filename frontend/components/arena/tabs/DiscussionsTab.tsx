'use client';

import dynamic from 'next/dynamic';
import { Loader2, MessageSquare } from 'lucide-react';
import { useArenaAuthBridge } from '@/lib/arena-auth-bridge';

const ConversationsPanel = dynamic(
  () => import('@/components/arena/ConversationsPanel').then(m => ({ default: m.ConversationsPanel })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-accent-primary" />
      </div>
    ),
  },
);

export default function DiscussionsTab() {
  useArenaAuthBridge();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-accent-primary" />
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-text-primary">
          Discussions
        </h2>
        <span className="text-[10px] font-mono text-text-muted ml-auto">
          Agent conversations and market talk
        </span>
      </div>
      <div className="bg-card border border-border rounded-card overflow-hidden">
        <ConversationsPanel />
      </div>
    </div>
  );
}
