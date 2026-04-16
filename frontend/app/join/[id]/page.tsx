'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouteParamId } from '@/hooks/useRouteParamId';
import { Users, Clock, Coins, ArrowLeft, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  getCompetition,
  joinCompetition,
  type Competition,
  type Participant,
} from '@/lib/derivarena-api';
import { getOrCreateTraderId } from '@/lib/derivarena-trader-id';

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusPill(status: string) {
  const s = status.toLowerCase();
  if (s === 'active') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (s === 'ended' || s === 'cancelled') return 'text-white/50 border-white/10 bg-white/[0.04]';
  return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
}

function formatDuration(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JoinPage() {
  const id = useRouteParamId('join');

  const [comp, setComp] = useState<Competition | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [traderName, setTraderName] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState<Participant | null>(null);

  const traderId = useRef<string>('');

  useEffect(() => {
    traderId.current = getOrCreateTraderId();
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCompetition(id)
      .then(setComp)
      .catch((err: Error) => {
        const msg = err.message || '';
        if (msg.startsWith('404') || msg.includes('not found')) {
          setLoadError('Competition not found.');
        } else {
          setLoadError('Could not load competition. Is the backend running?');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setJoinError(null);
    setJoining(true);
    try {
      const participant = await joinCompetition(id, {
        trader_id: traderId.current,
        trader_name: traderName.trim() || undefined,
      });
      setJoined(participant);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Join failed';
      if (msg.includes('400') || msg.includes('already')) {
        setJoinError('You have already joined this competition.');
      } else if (msg.includes('ended') || msg.includes('cancelled')) {
        setJoinError('This competition has ended and is no longer accepting entries.');
      } else {
        setJoinError('Could not join. Please try again.');
      }
    } finally {
      setJoining(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-bg-primary">
        <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (loadError || !comp) {
    return (
      <div className="min-h-[70vh] bg-bg-primary">
        <div className="container-colosseum py-14 max-w-lg">
          <div className="border border-amber-500/30 bg-amber-500/10 text-amber-300 p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">{loadError ?? 'Something went wrong.'}</p>
              <Link href="/competitions" className="text-xs text-accent-primary hover:underline mt-2 inline-block">
                ← Browse competitions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isJoinable = comp.status === 'pending' || comp.status === 'active';

  // ── Join success ───────────────────────────────────────────────────────────
  if (joined) {
    return (
      <div className="min-h-[70vh] bg-bg-primary">
        <div className="container-colosseum py-14 max-w-lg">
          <div className="border border-emerald-500/30 bg-emerald-500/10 p-6">
            <div className="flex items-center gap-2 text-emerald-400 font-bold mb-3">
              <CheckCircle2 className="w-5 h-5" />
              You're in!
            </div>
            <p className="text-sm text-text-muted mb-1">Competition</p>
            <p className="text-text-primary font-semibold mb-4">{comp.name}</p>
            <p className="text-xs text-text-muted mb-0.5">Your participant ID</p>
            <code className="text-xs text-text-primary break-all">{joined.id}</code>
            <div className="mt-5 flex gap-3">
              <Link
                href={`/competitions/${comp.id}`}
                className="px-4 py-2 text-xs font-bold bg-accent-primary/15 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/25"
              >
                View competition →
              </Link>
              <Link
                href="/competitions"
                className="px-4 py-2 text-xs text-text-muted border border-white/10 hover:border-white/20"
              >
                All competitions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main join flow ─────────────────────────────────────────────────────────
  return (
    <div className="min-h-[70vh] bg-bg-primary">
      <div className="container-colosseum py-10 sm:py-14 max-w-lg">
        <Link
          href="/competitions"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          All competitions
        </Link>

        {/* Competition summary card */}
        <div className="border border-white/[0.1] bg-white/[0.03] p-5 mb-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              {comp.partner_name && (
                <p className="text-[10px] font-mono uppercase tracking-widest text-accent-primary mb-1">
                  {comp.partner_name}
                </p>
              )}
              <h1 className="text-xl font-bold font-display text-text-primary">{comp.name}</h1>
            </div>
            <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border flex-shrink-0 ${statusPill(comp.status)}`}>
              {comp.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-text-muted mb-1">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wider font-mono">Duration</span>
              </div>
              <p className="text-sm font-semibold text-text-primary tabular-nums">
                {formatDuration(comp.duration_hours)}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-text-muted mb-1">
                <Coins className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wider font-mono">Balance</span>
              </div>
              <p className="text-sm font-semibold text-text-primary tabular-nums">
                ${Number(comp.starting_balance).toLocaleString()}
              </p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-text-muted mb-1">
                <Users className="w-3 h-3" />
                <span className="text-[10px] uppercase tracking-wider font-mono">Type</span>
              </div>
              <p className="text-xs font-semibold text-text-primary leading-snug">
                {(comp.contract_types || []).slice(0, 3).join(', ') || '—'}
                {(comp.contract_types || []).length > 3 && (
                  <span className="text-text-muted"> +{comp.contract_types.length - 3}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Join form */}
        {isJoinable ? (
          <div className="border border-white/[0.1] bg-white/[0.03] p-6">
            <h2 className="text-base font-bold text-text-primary mb-4">Join this competition</h2>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">
                  Display name <span className="opacity-50">(optional)</span>
                </label>
                <input
                  value={traderName}
                  onChange={(e) => setTraderName(e.target.value)}
                  maxLength={60}
                  className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm focus:border-accent-primary/50 focus:outline-none"
                  placeholder="Your trader alias"
                />
              </div>

              {joinError && (
                <div className="text-sm text-red-400 border border-red-500/20 bg-red-500/10 px-3 py-2">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full flex items-center justify-center gap-2 py-3 font-bold text-sm bg-accent-primary/15 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/25 disabled:opacity-50"
              >
                {joining && <Loader2 className="w-4 h-4 animate-spin" />}
                {joining ? 'Joining…' : 'Join competition — it\'s free'}
              </button>
            </form>
          </div>
        ) : (
          <div className="border border-white/[0.08] bg-white/[0.02] p-5 text-sm text-text-muted">
            This competition is <strong className="text-text-primary">{comp.status}</strong> and is
            not accepting new entries.{' '}
            <Link href="/competitions" className="text-accent-primary hover:underline">
              Find an open competition →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
