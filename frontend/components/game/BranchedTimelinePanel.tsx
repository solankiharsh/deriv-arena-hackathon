'use client';

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';
import { useTradeStore } from '@/lib/stores/trade-store';
import { computeBranchedTimelines, type TimelineBranch } from '@/lib/engines/branched-timeline';

export default function BranchedTimelinePanel() {
  const [isExpanded, setIsExpanded] = useState(true);
  const tradeHistory = useTradeStore((s) => s.tradeHistory);
  const activePosition = useTradeStore((s) => s.activePosition);

  const branches = useMemo(() => {
    const trades = tradeHistory.map((t) => ({
      id: t.id,
      asset: t.asset,
      direction: t.direction,
      stake: t.stake,
      entrySpot: t.entrySpot,
      exitSpot: t.exitSpot,
      pnl: t.pnl,
      status: t.status,
      heldToExpiry: t.heldToExpiry,
    }));

    const pos = activePosition ? {
      direction: activePosition.direction,
      stake: activePosition.stake,
      entrySpot: activePosition.entrySpot,
      currentSpot: activePosition.currentSpot,
      currentPnl: activePosition.currentPnl,
    } : null;

    return computeBranchedTimelines(trades, pos);
  }, [tradeHistory, activePosition]);

  const resolved = tradeHistory.filter((t) => t.status === 'won' || t.status === 'lost');
  const actualPnl = resolved.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const winRate = resolved.length > 0
    ? (resolved.filter((t) => t.status === 'won').length / resolved.length * 100).toFixed(0)
    : '0';

  if (resolved.length < 2 && branches.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 p-3 hover:bg-white/[0.02] transition-colors"
      >
        <GitBranch className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary">
          Branched Timelines
        </h3>
        <span className="ml-auto text-text-muted">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 pb-3"
          >
            {/* Current reality node */}
            <div className="relative pl-5 mb-1">
              <div className="absolute left-[7px] top-2 bottom-0 w-px bg-border" />
              <div className="absolute left-0 top-2 w-[15px] h-[15px] rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center">
                <div className="w-[5px] h-[5px] rounded-full bg-cyan-400" />
              </div>
              <div className="bg-white/[0.03] border border-border rounded-lg px-3 py-2 ml-1">
                <div className="text-[10px] font-mono uppercase text-text-muted tracking-wider mb-0.5">
                  Your Reality
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-mono font-bold ${actualPnl >= 0 ? 'text-success' : 'text-error'}`}>
                    ${actualPnl.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {resolved.length} trades &middot; {winRate}% WR
                  </span>
                </div>
              </div>
            </div>

            {/* Branch nodes */}
            {branches.map((branch, i) => (
              <BranchNode key={branch.id} branch={branch} isLast={i === branches.length - 1} />
            ))}

            {branches.length === 0 && (
              <div className="text-center py-3 text-text-muted text-xs pl-5">
                More trades needed for timeline branches...
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BranchNode({ branch, isLast }: { branch: TimelineBranch; isLast: boolean }) {
  const SentimentIcon = branch.sentiment === 'better'
    ? TrendingUp
    : branch.sentiment === 'worse'
      ? TrendingDown
      : Minus;

  const sentimentColor = branch.sentiment === 'better'
    ? 'text-success'
    : branch.sentiment === 'worse'
      ? 'text-error'
      : 'text-text-muted';

  const borderColor = branch.sentiment === 'better'
    ? 'border-emerald-500/20'
    : branch.sentiment === 'worse'
      ? 'border-red-500/20'
      : 'border-border';

  const dotColor = branch.sentiment === 'better'
    ? 'bg-emerald-500/20 border-emerald-500'
    : branch.sentiment === 'worse'
      ? 'bg-red-500/20 border-red-500'
      : 'bg-white/10 border-text-muted';

  return (
    <div className="relative pl-5">
      {!isLast && (
        <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border" />
      )}
      {isLast && (
        <div className="absolute left-[7px] top-0 h-4 w-px bg-border" />
      )}

      {/* Horizontal connector */}
      <div className="absolute left-[7px] top-[14px] w-3 h-px bg-border" />

      {/* Dot */}
      <div className={`absolute left-0 top-[8px] w-[15px] h-[15px] rounded-full ${dotColor} border-2 flex items-center justify-center`}>
        <SentimentIcon className={`w-[7px] h-[7px] ${sentimentColor}`} />
      </div>

      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className={`border ${borderColor} rounded-lg px-3 py-2 ml-1 mb-1 bg-white/[0.02]`}
      >
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[11px] font-medium text-text-primary">{branch.label}</span>
          <span className={`text-[11px] font-mono font-bold ${sentimentColor}`}>
            {branch.delta > 0 ? '+' : ''}{branch.delta.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted">{branch.description}</span>
          <span className={`text-[10px] font-mono ${branch.hypotheticalPnl >= 0 ? 'text-success' : 'text-error'}`}>
            ${branch.hypotheticalPnl.toFixed(2)}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
