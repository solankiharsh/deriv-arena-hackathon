'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Loader2 } from 'lucide-react';
import { getOrCreateTraderId } from '@/lib/derivarena-trader-id';
import { recordCompetitionTrade, type Participant } from '@/lib/derivarena-api';

type Props = {
  competitionId: string;
  status: string;
  contractTypes: string[];
  participants: Participant[];
  onRecorded?: () => void;
};

export function CompetitionDemoTradeForm({
  competitionId,
  status,
  contractTypes,
  participants,
  onRecorded,
}: Props) {
  const [contractType, setContractType] = useState(() => contractTypes[0] ?? 'CALL');
  const [symbol, setSymbol] = useState('1HZ100V');
  const [stake, setStake] = useState('50');
  const [pnl, setPnl] = useState('0');
  const [payout, setPayout] = useState('');
  const [contractId, setContractId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [localTraderId, setLocalTraderId] = useState('');

  useEffect(() => {
    setLocalTraderId(getOrCreateTraderId());
  }, []);

  const isJoined = localTraderId !== '' && participants.some((p) => p.trader_id === localTraderId);

  if (status !== 'active') {
    return null;
  }

  if (contractTypes.length === 0) {
    return (
      <div className="border border-white/[0.08] bg-white/[0.02] p-4 mb-6 text-sm text-text-muted">
        <ClipboardList className="w-4 h-4 inline mr-2 align-text-bottom opacity-60" />
        No contract types configured for this competition — add some when creating the comp to log trades.
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="border border-white/[0.08] bg-white/[0.02] p-4 mb-6 text-sm text-text-muted">
        <ClipboardList className="w-4 h-4 inline mr-2 align-text-bottom opacity-60" />
        Join this competition in{' '}
        <Link href={`/join/${competitionId}`} className="text-accent-primary hover:underline">
          this browser
        </Link>{' '}
        first to record a demo trade (your trader id is stored locally).
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const tid = getOrCreateTraderId();
      await recordCompetitionTrade(competitionId, {
        trader_id: tid,
        contract_type: contractType,
        symbol: symbol.trim(),
        stake: stake.trim(),
        pnl: pnl.trim(),
        payout: payout.trim() || undefined,
        contract_id: contractId.trim() || undefined,
      });
      setSuccess('Trade recorded — leaderboard will refresh on the next tick.');
      onRecorded?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setError(msg.replace(/^(\d{3}):\s*/, ''));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-white/[0.1] bg-white/[0.03] p-6 mb-8">
      <h2 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-accent-primary/80" />
        Log demo trade
      </h2>
      <p className="text-xs text-text-muted mb-4">
        Integration hook until Deriv fills stream here. Uses your saved <span className="font-mono">trader_id</span> — same
        as join.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">Contract</label>
            <select
              value={contractType}
              onChange={(e) => setContractType(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm focus:border-accent-primary/50 focus:outline-none"
            >
              {contractTypes.map((ct) => (
                <option key={ct} value={ct}>
                  {ct}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">Symbol</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm focus:border-accent-primary/50 focus:outline-none font-mono"
              placeholder="1HZ100V"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">Stake</label>
            <input
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm tabular-nums focus:border-accent-primary/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">
              P&amp;L (closed)
            </label>
            <input
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm tabular-nums focus:border-accent-primary/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">
              Payout <span className="opacity-50">(optional)</span>
            </label>
            <input
              value={payout}
              onChange={(e) => setPayout(e.target.value)}
              className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm tabular-nums focus:border-accent-primary/50 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">
            Contract ID <span className="opacity-50">(optional)</span>
          </label>
          <input
            value={contractId}
            onChange={(e) => setContractId(e.target.value)}
            className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm font-mono focus:border-accent-primary/50 focus:outline-none"
            placeholder="From Deriv proposal_open_contract"
          />
        </div>

        {error && (
          <div className="text-sm text-red-400 border border-red-500/20 bg-red-500/10 px-3 py-2">{error}</div>
        )}
        {success && (
          <div className="text-sm text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">{success}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 font-bold text-sm bg-accent-primary/15 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/25 disabled:opacity-50"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitting ? 'Recording…' : 'Record trade'}
        </button>
      </form>
    </div>
  );
}
