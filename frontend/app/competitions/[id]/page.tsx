'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouteParamId } from '@/hooks/useRouteParamId';
import {
  ArrowLeft,
  Clock,
  Coins,
  Users,
  Copy,
  Check,
  ExternalLink,
  Loader2,
  AlertTriangle,
  CalendarClock,
  Shield,
} from 'lucide-react';
import {
  getCompetition,
  listParticipants,
  type Competition,
  type Participant,
  type PartnerRules,
} from '@/lib/derivarena-api';
import { CompetitionDemoTradeForm } from '@/components/derivarena/CompetitionDemoTradeForm';
import { CompetitionLeaderboard } from '@/components/derivarena/CompetitionLeaderboard';

// ── Helpers ──────────────────────────────────────────────────────────────────

function partnerRulesNonEmpty(pr?: PartnerRules | null): boolean {
  if (!pr || typeof pr !== 'object') return false;
  return !!(
    pr.max_stake_per_contract
    || pr.max_loss_per_day
    || pr.max_drawdown_percent
    || pr.market_bias
    || (pr.data_source_weights && Object.keys(pr.data_source_weights).length > 0)
  );
}

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

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// ── Copy-to-clipboard button ──────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available (e.g. non-secure context) — silent fail
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-white/10 text-text-muted hover:border-white/20 hover:text-text-secondary transition-colors"
      title="Copy share link"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CompetitionDetailPage() {
  const id = useRouteParamId('competitions');

  const [comp, setComp] = useState<Competition | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setLoadError(null);

    Promise.all([
      getCompetition(id),
      listParticipants(id).catch(() => [] as Participant[]),
    ])
      .then(([c, ps]) => {
        setComp(c);
        setParticipants(Array.isArray(ps) ? ps : []);
      })
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

  const refreshParticipants = useCallback(() => {
    if (!id) return;
    listParticipants(id)
      .then((ps) => setParticipants(Array.isArray(ps) ? ps : []))
      .catch(() => {});
  }, [id]);

  // ── Share URL ────────────────────────────────────────────────────────────
  const shareUrl =
    comp?.share_url ??
    (typeof window !== 'undefined' && id ? `${window.location.origin}/join/${id}` : '');

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center bg-bg-primary">
        <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (loadError || !comp) {
    return (
      <div className="min-h-[70vh] bg-bg-primary">
        <div className="container-colosseum py-14 max-w-2xl">
          <div className="border border-amber-500/30 bg-amber-500/10 text-amber-300 p-5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">{loadError ?? 'Something went wrong.'}</p>
              <Link
                href="/competitions"
                className="text-xs text-accent-primary hover:underline mt-2 inline-block"
              >
                ← Back to competitions
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isJoinable = comp.status === 'pending' || comp.status === 'active';
  const participantList = Array.isArray(participants) ? participants : [];

  return (
    <div className="min-h-[70vh] bg-bg-primary">
      <div className="container-colosseum py-10 sm:py-14 max-w-2xl">

        {/* Back nav */}
        <Link
          href="/competitions"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          All competitions
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            {comp.partner_name && (
              <p className="text-[10px] font-mono uppercase tracking-widest text-accent-primary mb-1">
                {comp.partner_name}
              </p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-text-primary">
              {comp.name}
            </h1>
          </div>
          <span
            className={`text-[10px] font-mono uppercase px-2.5 py-1 border self-start ${statusPill(comp.status)}`}
          >
            {comp.status}
          </span>
        </div>

        {/* Stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 text-text-muted mb-1.5">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Duration</span>
            </div>
            <p className="text-sm font-semibold text-text-primary tabular-nums">
              {formatDuration(comp.duration_hours)}
            </p>
          </div>
          <div className="border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 text-text-muted mb-1.5">
              <Coins className="w-3 h-3" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Balance</span>
            </div>
            <p className="text-sm font-semibold text-text-primary tabular-nums">
              ${Number(comp.starting_balance).toLocaleString()}
            </p>
          </div>
          <div className="border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 text-text-muted mb-1.5">
              <Users className="w-3 h-3" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Traders</span>
            </div>
            <p className="text-sm font-semibold text-text-primary tabular-nums">
              {participantList.length}
            </p>
          </div>
          <div className="border border-white/[0.08] bg-white/[0.02] p-3">
            <div className="flex items-center gap-1.5 text-text-muted mb-1.5">
              <CalendarClock className="w-3 h-3" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Ends</span>
            </div>
            <p className="text-sm font-semibold text-text-primary">
              {formatDateTime(comp.end_time)}
            </p>
          </div>
        </div>

        {/* Contract types */}
        <div className="border border-white/[0.08] bg-white/[0.02] p-4 mb-6">
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
            Allowed contracts
          </p>
          <div className="flex flex-wrap gap-2">
            {(comp.contract_types || []).map((ct) => (
              <span
                key={ct}
                className="px-2 py-0.5 text-xs font-mono border border-accent-primary/30 bg-accent-primary/10 text-accent-primary"
              >
                {ct}
              </span>
            ))}
            {(comp.contract_types || []).length === 0 && (
              <span className="text-text-muted text-xs">—</span>
            )}
          </div>
        </div>

        {/* Partner rules (host) */}
        {partnerRulesNonEmpty(comp.partner_rules) && (
          <div className="border border-white/[0.08] bg-white/[0.02] p-4 mb-6">
            <div className="flex items-center gap-2 text-text-muted mb-3">
              <Shield className="w-3.5 h-3.5" />
              <p className="text-[10px] font-mono uppercase tracking-wider">Partner rules</p>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {comp.partner_rules?.max_stake_per_contract && (
                <>
                  <dt className="text-text-muted text-xs">Max stake / contract</dt>
                  <dd className="text-text-primary font-mono tabular-nums">{comp.partner_rules.max_stake_per_contract}</dd>
                </>
              )}
              {comp.partner_rules?.max_loss_per_day && (
                <>
                  <dt className="text-text-muted text-xs">Max loss / day</dt>
                  <dd className="text-text-primary font-mono tabular-nums">{comp.partner_rules.max_loss_per_day}</dd>
                </>
              )}
              {comp.partner_rules?.max_drawdown_percent && (
                <>
                  <dt className="text-text-muted text-xs">Max drawdown</dt>
                  <dd className="text-text-primary font-mono tabular-nums">{comp.partner_rules.max_drawdown_percent}%</dd>
                </>
              )}
              {comp.partner_rules?.market_bias && (
                <>
                  <dt className="text-text-muted text-xs">Market bias</dt>
                  <dd className="text-text-primary font-mono tabular-nums">{comp.partner_rules.market_bias}</dd>
                </>
              )}
            </dl>
            {comp.partner_rules?.data_source_weights && Object.keys(comp.partner_rules.data_source_weights).length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">Signal weights</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(comp.partner_rules.data_source_weights).map(([k, v]) => (
                    <span
                      key={k}
                      className="px-2 py-0.5 text-xs font-mono border border-white/10 bg-white/[0.04] text-text-secondary"
                    >
                      {k}: {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[10px] text-text-muted mt-3 leading-relaxed">
              Server-side on <code className="text-[9px]">POST …/trade</code>: max stake per contract, max loss per UTC day
              (sum of losing trade |PnL|), and max drawdown percent vs equity path from starting balance. The Arena{' '}
              <span className="text-white/55">Paper swarm</span> column applies the same three caps client-side when an active
              competition with rules is loaded. Signal weights and bias
              still blend into analyzer weights there.
            </p>
          </div>
        )}

        {/* Timing */}
        <div className="border border-white/[0.08] bg-white/[0.02] p-4 mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
              Started
            </p>
            <p className="text-text-primary">{formatDateTime(comp.start_time)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
              Ends
            </p>
            <p className="text-text-primary">{formatDateTime(comp.end_time)}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
              Created
            </p>
            <p className="text-text-primary">{formatDateTime(comp.created_at)}</p>
          </div>
          {comp.partner_id && (
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
                Partner ID
              </p>
              <p className="text-text-primary font-mono text-xs">{comp.partner_id}</p>
            </div>
          )}
        </div>

        {/* Share link */}
        {shareUrl && (
          <div className="border border-white/[0.08] bg-white/[0.02] p-4 mb-6">
            <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
              Share link
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-primary break-all hover:underline flex items-center gap-1"
              >
                {shareUrl}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
              <CopyButton text={shareUrl} />
            </div>
          </div>
        )}

        {/* CTA */}
        {isJoinable && (
          <Link
            href={`/join/${comp.id}`}
            className="inline-flex items-center gap-2 px-5 py-3 font-bold text-sm bg-accent-primary/15 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/25 mb-8"
          >
            Join this competition →
          </Link>
        )}

        <CompetitionDemoTradeForm
          competitionId={comp.id}
          status={comp.status}
          contractTypes={comp.contract_types || []}
          participants={participantList}
          onRecorded={refreshParticipants}
        />

        {/* Live leaderboard */}
        <div className="mb-10">
          <CompetitionLeaderboard competitionId={comp.id} />
        </div>

        {/* Participants */}
        <div>
          <h2 className="text-base font-bold text-text-primary mb-3">
            Participants
            <span className="ml-2 text-xs font-mono text-text-muted">({participantList.length})</span>
          </h2>

          {participantList.length === 0 ? (
            <p className="text-sm text-text-muted">
              No one has joined yet.{' '}
              {isJoinable && (
                <Link href={`/join/${comp.id}`} className="text-accent-primary hover:underline">
                  Be the first →
                </Link>
              )}
            </p>
          ) : (
            <div className="border border-white/[0.08] bg-white/[0.02]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-text-muted">
                    <th className="px-4 py-2.5 font-semibold">#</th>
                    <th className="px-4 py-2.5 font-semibold">Name</th>
                    <th className="px-4 py-2.5 font-semibold hidden sm:table-cell">Trader ID</th>
                    <th className="px-4 py-2.5 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {participantList.map((p, i) => (
                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-2.5 text-text-muted tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2.5 text-text-primary font-medium">
                        {p.trader_name || (
                          <span className="text-text-muted italic">anonymous</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <code className="text-xs text-text-muted">
                          {(p.trader_id ?? '').length > 8
                            ? `${(p.trader_id ?? '').slice(0, 8)}…`
                            : (p.trader_id ?? '—')}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-text-muted text-xs">
                        {formatDateTime(p.joined_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
