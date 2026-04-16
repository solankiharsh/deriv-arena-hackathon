'use strict';

import { joinCompetition, recordCompetitionTrade, type Competition } from '@/lib/derivarena-api';
import { getOrCreateTraderId } from '@/lib/derivarena-trader-id';
import type { PaperPosition } from './ledger';

const LS_MIRROR_COMP_ID = 'derivarena-paper-mirror-competition-id';
const LS_MIRROR_ENABLED = 'derivarena-paper-post-closes';

/** Manual UUID overrides env and auto-picked active competition */
export function getPaperMirrorCompetitionId(): string | null {
  if (typeof window !== 'undefined') {
    const manual = localStorage.getItem(LS_MIRROR_COMP_ID)?.trim();
    if (manual) return manual;
  }
  const env = process.env.NEXT_PUBLIC_PAPER_MIRROR_COMPETITION_ID?.trim();
  return env || null;
}

export function setPaperMirrorCompetitionId(id: string): void {
  if (typeof window === 'undefined') return;
  const t = id.trim();
  if (!t) localStorage.removeItem(LS_MIRROR_COMP_ID);
  else localStorage.setItem(LS_MIRROR_COMP_ID, t);
}

export function isPaperMirrorPostingEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LS_MIRROR_ENABLED) === '1';
}

export function setPaperMirrorPostingEnabled(on: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_MIRROR_ENABLED, on ? '1' : '0');
}

function pickContractType(side: string, allowedRaw: string[] | undefined): string {
  const sideU = side.toUpperCase();
  const allowed = (allowedRaw?.length ? allowedRaw : ['CALL', 'PUT']).map((c) => c.trim().toUpperCase());
  if (allowed.includes(sideU)) return sideU;
  if (allowed.includes('CALL')) return 'CALL';
  return allowed[0] || 'CALL';
}

function sanitizeSymbol(s: string): string {
  return s.replace(/[^\w]/g, '').slice(0, 32);
}

/**
 * Ensures this browser's trader_id is a participant, then posts each closed leg to
 * POST /api/competitions/:id/trade (Go competition store + stats).
 */
export async function mirrorPaperClosesToCompetition(
  competitionId: string,
  comp: Competition | null,
  closes: PaperPosition[],
): Promise<{ posted: number; errors: string[] }> {
  const errors: string[] = [];
  if (!competitionId || closes.length === 0) return { posted: 0, errors };

  const tid = getOrCreateTraderId();
  if (!tid) {
    errors.push('No trader_id (browser storage unavailable)');
    return { posted: 0, errors };
  }

  try {
    await joinCompetition(competitionId, {
      trader_id: tid,
      trader_name: 'Paper swarm',
      participant_kind: 'agent',
      metadata: { source: 'paper_swarm' },
    });
  } catch {
    /* duplicate join returns existing participant via ON CONFLICT path */
  }

  let posted = 0;
  const allowedTypes = comp?.contract_types;

  for (const p of closes) {
    const ct = pickContractType(p.side, allowedTypes);
    const stake = Number.isFinite(p.stake) && p.stake > 0 ? p.stake : 0.01;
    const pnlVal = p.pnl ?? 0;
    try {
      await recordCompetitionTrade(competitionId, {
        trader_id: tid,
        contract_type: ct,
        symbol: sanitizeSymbol(p.symbol) || 'UNKNOWN',
        stake: stake.toFixed(4),
        pnl: pnlVal.toFixed(4),
        contract_id: p.id.replace(/[^\w-]/g, '').slice(0, 64),
      });
      posted += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg.slice(0, 200));
    }
  }

  return { posted, errors };
}
