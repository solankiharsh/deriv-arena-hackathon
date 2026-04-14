'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { LayoutList, RefreshCw, ExternalLink } from 'lucide-react';
import { listCompetitions, type Competition } from '@/lib/derivarena-api';

async function fetchCompetitions(): Promise<Competition[]> {
  return listCompetitions();
}

function statusPill(status: string) {
  const s = status.toLowerCase();
  if (s === 'active') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (s === 'ended' || s === 'cancelled') return 'text-white/50 border-white/10 bg-white/[0.04]';
  return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
}

export default function CompetitionsPage() {
  const { data, error, isLoading, mutate } = useSWR('derivarena-competitions', fetchCompetitions, {
    refreshInterval: 20_000,
    revalidateOnFocus: true,
  });

  return (
    <div className="min-h-[70vh] bg-bg-primary">
      <div className="container-colosseum py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-accent-primary mb-2">
              <LayoutList className="w-4 h-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest">DerivArena API</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-text-primary">Competitions</h1>
            <p className="text-sm text-text-muted mt-1 max-w-xl">
              Live data from <code className="text-xs">GET /api/competitions</code>. Create new ones from{' '}
              <Link href="/create" className="text-accent-primary hover:underline">Create</Link>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => mutate()}
            className="inline-flex items-center gap-2 self-start px-3 py-2 text-xs font-semibold border border-white/10 hover:border-white/20 bg-white/[0.03] text-text-secondary"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {isLoading && !data && (
          <p className="text-sm text-text-muted">Loading…</p>
        )}

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 text-red-300 text-sm p-4 mb-6">
            Could not load competitions. Is the Go API running at{' '}
            <code className="text-xs">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090'}</code>?
            <div className="text-xs mt-2 opacity-80">{(error as Error).message}</div>
          </div>
        )}

        {data && data.length === 0 && !isLoading && (
          <p className="text-text-muted text-sm">No competitions yet.{' '}
            <Link href="/create" className="text-accent-primary hover:underline">Create the first one</Link>.
          </p>
        )}

        {data && data.length > 0 && (
          <div className="overflow-x-auto border border-white/[0.08] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Balance</th>
                  <th className="px-4 py-3 font-semibold">Contracts</th>
                  <th className="px-4 py-3 font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.map((c) => (
                  <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      <Link href={`/competitions/${c.id}`} className="hover:text-accent-primary hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${statusPill(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-muted tabular-nums">{c.duration_hours}h</td>
                    <td className="px-4 py-3 text-text-muted tabular-nums">{c.starting_balance}</td>
                    <td className="px-4 py-3 text-text-muted text-xs max-w-[200px] truncate">
                      {(c.contract_types || []).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      {c.share_url ? (
                        <a
                          href={c.share_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-accent-primary hover:underline"
                        >
                          Link <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
