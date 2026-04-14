'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PlusCircle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { createCompetition, type Competition } from '@/lib/derivarena-api';

const DURATION_OPTIONS = [
  { value: 1, label: '1 hour' },
  { value: 6, label: '6 hours' },
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '1 week' },
] as const;

const CONTRACT_PRESETS = ['CALL', 'PUT', 'ACCU', 'MULTUP', 'MULTDOWN', 'DIGITEVEN', 'DIGITODD'] as const;

export default function CreateCompetitionPage() {
  const [name, setName] = useState('');
  const [durationHours, setDurationHours] = useState<number>(24);
  const [startingBalance, setStartingBalance] = useState('10000');
  const [partnerName, setPartnerName] = useState('');
  const [appId, setAppId] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['CALL', 'PUT']);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Competition | null>(null);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreated(null);
    if (!name.trim()) {
      setError('Competition name is required.');
      return;
    }
    if (selectedTypes.length === 0) {
      setError('Pick at least one contract type.');
      return;
    }
    const bal = startingBalance.trim();
    if (!bal || Number(bal) <= 0) {
      setError('Starting balance must be a positive number.');
      return;
    }

    setSubmitting(true);
    try {
      const comp = await createCompetition({
        name: name.trim(),
        duration_hours: durationHours,
        contract_types: selectedTypes,
        starting_balance: bal,
        partner_name: partnerName.trim() || undefined,
        app_id: appId.trim() || undefined,
      });
      setCreated(comp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-bg-primary">
      <div className="container-colosseum py-10 sm:py-14 max-w-xl">
        <Link
          href="/competitions"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-secondary mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          All competitions
        </Link>

        <div className="border border-white/[0.1] bg-white/[0.03] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-6">
            <PlusCircle className="w-8 h-8 text-accent-primary" />
            <h1 className="text-2xl font-bold font-display text-text-primary">Create competition</h1>
          </div>

          <p className="text-sm text-text-muted mb-6">
            Posts to <code className="text-xs">POST /api/competitions</code> on your DerivArena backend.
            The full product roadmap lives in <code className="text-xs">docs/ROADMAP.md</code> in this repository.
          </p>

          {created && (
            <div className="mb-6 p-4 border border-emerald-500/30 bg-emerald-500/10 text-sm">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-2">
                <CheckCircle2 className="w-4 h-4" />
                Competition created
              </div>
              <p className="text-text-muted text-xs mb-1">ID</p>
              <code className="text-xs text-text-primary break-all">{created.id}</code>
              {created.share_url && (
                <>
                  <p className="text-text-muted text-xs mt-3 mb-1">Share URL</p>
                  <a
                    href={created.share_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent-primary break-all hover:underline"
                  >
                    {created.share_url}
                  </a>
                </>
              )}
              <div className="mt-4 flex gap-3 flex-wrap">
                <Link
                  href={`/competitions/${created.id}`}
                  className="text-xs font-semibold text-accent-primary hover:underline"
                >
                  Open competition →
                </Link>
                <Link
                  href="/competitions"
                  className="text-xs text-text-muted hover:text-text-secondary"
                >
                  View list
                </Link>
                <button
                  type="button"
                  className="text-xs text-text-muted hover:text-text-secondary"
                  onClick={() => {
                    setCreated(null);
                    setName('');
                  }}
                >
                  Create another
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm focus:border-accent-primary/50 focus:outline-none"
                placeholder="Weekend Volatility Cup"
                maxLength={120}
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">Duration</label>
              <select
                value={durationHours}
                onChange={(e) => setDurationHours(Number(e.target.value))}
                className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm focus:border-accent-primary/50 focus:outline-none"
              >
                {DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">
                Starting balance (demo)
              </label>
              <input
                value={startingBalance}
                onChange={(e) => setStartingBalance(e.target.value)}
                type="number"
                min={100}
                max={100000}
                step={100}
                className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm focus:border-accent-primary/50 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-2">
                Contract types
              </label>
              <div className="flex flex-wrap gap-2">
                {CONTRACT_PRESETS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`px-2.5 py-1 text-xs font-mono border transition-colors ${
                      selectedTypes.includes(t)
                        ? 'border-accent-primary/50 bg-accent-primary/15 text-accent-primary'
                        : 'border-white/10 text-text-muted hover:border-white/20'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">
                Partner display name <span className="opacity-50">(optional)</span>
              </label>
              <input
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm focus:border-accent-primary/50 focus:outline-none"
                placeholder="My community"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-text-muted mb-1.5">
                Deriv <code className="text-[10px]">app_id</code> <span className="opacity-50">(optional)</span>
              </label>
              <input
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                className="w-full px-3 py-2 bg-bg-primary border border-white/10 text-text-primary text-sm focus:border-accent-primary/50 focus:outline-none"
                placeholder="Referral / commission attribution"
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 border border-red-500/20 bg-red-500/10 px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 font-bold text-sm bg-accent-primary/15 border border-accent-primary/40 text-accent-primary hover:bg-accent-primary/25 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? 'Creating…' : 'Create competition'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
