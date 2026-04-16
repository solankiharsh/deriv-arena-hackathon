'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useArenaAuthBridge } from '@/lib/arena-auth-bridge';

const AgentDataFlow = dynamic(
  () => import('@/components/dashboard/AgentDataFlow').then(m => ({ default: m.AgentDataFlow })),
  {
    ssr: false,
    loading: () => <Skeleton />,
  },
);

const AgentConfigPanel = dynamic(
  () => import('@/components/dashboard/AgentConfigPanel').then(m => ({ default: m.AgentConfigPanel })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px]" />,
  },
);

function Skeleton({ className = 'h-[420px]' }: { className?: string }) {
  return (
    <div className={`bg-white/[0.03] animate-pulse rounded-card ${className}`} />
  );
}

export default function CommandCenterTab() {
  useArenaAuthBridge();

  return (
    <div className="space-y-6 animate-arena-reveal">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-sm font-black font-mono text-white tracking-tight uppercase">
          Command Center
        </h2>
        <span className="text-[10px] font-mono text-text-muted">
          Your agent&apos;s data ingestion pipeline
        </span>
      </div>
      <AgentDataFlow />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentConfigPanel />
      </div>
    </div>
  );
}
