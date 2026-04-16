'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LayoutList, RefreshCw, Clock, Users, Trophy, Loader2, Plus } from 'lucide-react';
import { arenaApi } from '@/lib/arena-api';
import type { GameTemplate, GameMode } from '@/lib/arena-types';
import { GAME_MODE_LABELS } from '@/lib/arena-types';

function statusPill(isActive: boolean) {
  return isActive
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : 'text-white/50 border-white/10 bg-white/[0.04]';
}

export default function CompetitionsPage() {
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { templates: data } = await arenaApi.templates.list();
      setTemplates(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-[70vh] bg-bg-primary">
      <div className="container-colosseum py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-accent-primary mb-2">
              <LayoutList className="w-4 h-4" />
              <span className="text-[10px] font-mono uppercase tracking-widest">DerivArena</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-text-primary">Competitions</h1>
            <p className="text-sm text-text-muted mt-1 max-w-xl">
              Browse game templates and join competitions. Create new ones from{' '}
              <Link href="/create" className="text-accent-primary hover:underline">Create</Link>.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-white/10 hover:border-white/20 bg-white/[0.03] text-text-secondary"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-accent-primary/30 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20"
            >
              <Plus className="w-3.5 h-3.5" />
              Create
            </Link>
          </div>
        </div>

        {loading && templates.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
          </div>
        )}

        {error && (
          <div className="border border-red-500/30 bg-red-500/10 text-red-300 text-sm p-4 mb-6">
            {error}
          </div>
        )}

        {!loading && !error && templates.length === 0 && (
          <p className="text-text-muted text-sm">No competitions yet.{' '}
            <Link href="/create" className="text-accent-primary hover:underline">Create the first one</Link>.
          </p>
        )}

        {templates.length > 0 && (
          <div className="overflow-x-auto border border-white/[0.08] bg-white/[0.02]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-[10px] uppercase tracking-wider text-text-muted">
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Mode</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Players</th>
                  <th className="px-4 py-3 font-semibold">Plays</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => {
                  const config = typeof t.config === 'string' ? JSON.parse(t.config) : t.config;
                  return (
                    <tr key={t.id} className="border-b border-white/[0.04] hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-text-primary">
                        <Link href={`/compete/${t.slug}`} className="hover:text-accent-primary hover:underline">
                          {t.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-muted text-xs font-mono">
                        {GAME_MODE_LABELS[t.game_mode as GameMode] || t.game_mode}
                      </td>
                      <td className="px-4 py-3 text-text-muted tabular-nums">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {config?.duration_minutes || '—'}m
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted tabular-nums">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {config?.max_players || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted tabular-nums">
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {t.play_count}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${statusPill(t.is_active)}`}>
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
