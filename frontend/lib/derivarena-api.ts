'use strict';

/**
 * Thin client for the DerivArena Go competition API.
 * Base URL: NEXT_PUBLIC_API_URL (default http://localhost:8090).
 */

function apiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';
  return u.replace(/\/$/, '');
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    const msg = text.slice(0, 200) || res.statusText;
    throw new Error(`${res.status}: ${msg}`);
  }
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

/** Ensures list endpoints never yield `null` or a non-array to callers. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export type Competition = {
  id: string;
  name: string;
  partner_id?: string;
  partner_name?: string;
  app_id?: string;
  duration_hours: number;
  contract_types: string[];
  /** Serialized decimal from Go */
  starting_balance: string;
  status: string;
  start_time?: string | null;
  end_time?: string | null;
  share_url?: string;
  created_at: string;
  updated_at: string;
};

export type CreateCompetitionInput = {
  name: string;
  duration_hours: number;
  contract_types: string[];
  /** Positive decimal as string, e.g. "10000" */
  starting_balance: string;
  partner_id?: string;
  partner_name?: string;
  app_id?: string;
};

export async function listCompetitions(status?: string): Promise<Competition[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${apiBase()}/api/competitions${q}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const data = await parseJson<unknown>(res);
  return asArray<Competition>(data);
}

export async function getCompetition(id: string): Promise<Competition> {
  const res = await fetch(`${apiBase()}/api/competitions/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  return parseJson<Competition>(res);
}

export async function createCompetition(body: CreateCompetitionInput): Promise<Competition> {
  const res = await fetch(`${apiBase()}/api/competitions`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson<Competition>(res);
}

export type Participant = {
  id: string;
  competition_id: string;
  trader_id: string;
  trader_name?: string;
  deriv_account_id?: string;
  /** `"human"` | `"agent"` — default human when omitted */
  participant_kind?: string;
  /** Small JSON object for display (policy label, version); no secrets */
  metadata?: Record<string, unknown>;
  joined_at: string;
};

export type JoinCompetitionInput = {
  trader_id: string;
  trader_name?: string;
  participant_kind?: 'human' | 'agent';
  metadata?: Record<string, unknown>;
};

export async function joinCompetition(
  competitionId: string,
  body: JoinCompetitionInput,
): Promise<Participant> {
  const payload: Record<string, unknown> = {
    trader_id: body.trader_id,
    trader_name: body.trader_name,
    participant_kind: body.participant_kind,
  };
  if (body.metadata != null) {
    payload.metadata = body.metadata;
  }
  const res = await fetch(
    `${apiBase()}/api/competitions/${encodeURIComponent(competitionId)}/join`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  return parseJson<Participant>(res);
}

export async function listParticipants(competitionId: string): Promise<Participant[]> {
  const res = await fetch(
    `${apiBase()}/api/competitions/${encodeURIComponent(competitionId)}/participants`,
    { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
  );
  const data = await parseJson<unknown>(res);
  return asArray<Participant>(data);
}

export type LeaderboardEntry = {
  // Participant fields
  id: string;
  competition_id: string;
  trader_id: string;
  trader_name?: string;
  deriv_account_id?: string;
  participant_kind?: string;
  metadata?: Record<string, unknown>;
  joined_at: string;
  // Stats fields (null/undefined when no trades yet)
  total_trades: number;
  profitable_trades: number;
  loss_trades: number;
  total_pnl: string;
  sortino_ratio?: string | null;
  max_drawdown?: string | null;
  current_balance: string;
  last_updated: string;
  // Rank
  rank: number;
};

export async function getLeaderboard(competitionId: string): Promise<LeaderboardEntry[]> {
  const res = await fetch(
    `${apiBase()}/api/competitions/${encodeURIComponent(competitionId)}/leaderboard`,
    { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store' },
  );
  const data = await parseJson<unknown>(res);
  return asArray<LeaderboardEntry>(data);
}

/** Returns the SSE stream URL — caller manages the EventSource lifecycle. */
export function leaderboardStreamUrl(competitionId: string): string {
  return `${apiBase()}/api/competitions/${encodeURIComponent(competitionId)}/leaderboard/stream`;
}
