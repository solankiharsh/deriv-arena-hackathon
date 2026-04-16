'use client';

import dynamic from 'next/dynamic';
import { Loader2, Map as MapIcon } from 'lucide-react';
import { useArenaAuthBridge } from '@/lib/arena-auth-bridge';

const AgentMap = dynamic(
  () => import('@/components/arena/AgentMap').then(m => ({ default: m.AgentMap })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[500px] bg-white/[0.02] rounded-card">
        <div className="text-center space-y-2">
          <Loader2 className="w-5 h-5 animate-spin text-accent-primary mx-auto" />
          <span className="text-[10px] font-mono text-text-muted">Loading spatial intelligence...</span>
        </div>
      </div>
    ),
  },
);

export default function MapTab() {
  useArenaAuthBridge();

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MapIcon className="w-4 h-4 text-accent-primary" />
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-text-primary">
          Agent Map
        </h2>
        <span className="text-[10px] font-mono text-text-muted ml-auto">
          Spatial view of active agents
        </span>
      </div>
      <div className="h-[500px] rounded-card overflow-hidden border border-border">
        <AgentMap />
      </div>
    </div>
  );
}
