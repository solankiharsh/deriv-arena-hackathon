import type {
  ArenaUser,
  GameTemplate,
  GameInstance,
  InstancePlayer,
  GlobalLeaderboardEntry,
  AdminStats,
  PartnerStats,
  ConversionEvent,
  UserRole,
  GameMode,
} from './arena-types';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const text = await res.text();
      const body = JSON.parse(text);
      if (body.error) message = body.error;
    } catch { /* use default message */ }
    throw new Error(message);
  }
  return res.json();
}

export const arenaApi = {
  auth: {
    me: () => apiFetch<{ user: ArenaUser | null }>('/api/auth/me'),
    setRole: (role: UserRole) =>
      apiFetch<{ success: boolean; user: ArenaUser }>('/api/auth/role', {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    logout: () =>
      apiFetch<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),
    demo: (data: { role: string }) =>
      apiFetch<{ user: ArenaUser }>('/api/auth/demo', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  templates: {
    list: (mode?: GameMode) =>
      apiFetch<{ templates: GameTemplate[] }>(
        `/api/templates${mode ? `?mode=${mode}` : ''}`,
      ),
    get: (slug: string) =>
      apiFetch<{ template: GameTemplate; instances: GameInstance[] }>(
        `/api/templates/${slug}`,
      ),
    mine: () => apiFetch<{ templates: GameTemplate[] }>('/api/templates/mine'),
    create: (data: {
      name: string;
      description: string;
      game_mode: GameMode;
      config: Record<string, unknown>;
    }) =>
      apiFetch<{ template: GameTemplate }>('/api/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  instances: {
    list: (filters?: { status?: string; template_id?: string }) => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.template_id) params.set('template_id', filters.template_id);
      return apiFetch<{ instances: GameInstance[] }>(
        `/api/instances?${params.toString()}`,
      );
    },
    get: (id: string) =>
      apiFetch<{ instance: GameInstance; players: InstancePlayer[] }>(
        `/api/instances/${id}`,
      ),
    create: (template_slug: string) =>
      apiFetch<{ instance: GameInstance }>('/api/instances', {
        method: 'POST',
        body: JSON.stringify({ template_slug }),
      }),
    join: (id: string, referral?: { referred_by?: string; source?: string }) =>
      apiFetch<{ player: InstancePlayer; already_joined: boolean }>(
        `/api/instances/${id}/join`,
        { method: 'POST', body: JSON.stringify(referral ?? {}) },
      ),
    start: (id: string) =>
      apiFetch<{ success: boolean; started_at: string; ends_at: string }>(
        `/api/instances/${id}/start`,
        { method: 'POST' },
      ),
    submitScore: (
      id: string,
      data: {
        score: number;
        pnl: number;
        trades_count: number;
        behavioral_score: number;
        metadata?: Record<string, unknown>;
      },
    ) =>
      apiFetch<{
        rank: number;
        total_players: number;
        percentile: number;
        normalized_score: number;
        surpassed_85: boolean;
        leaderboard: Array<{ user_id: string; score: number; pnl: number; rank: number }>;
      }>(`/api/instances/${id}/live-score`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    finalize: (id: string) =>
      apiFetch<{ success: boolean }>(`/api/instances/${id}/finalize`, {
        method: 'POST',
      }),
    liveLeaderboard: (id: string) =>
      apiFetch<{ players: (InstancePlayer & { display_name: string })[] }>(
        `/api/instances/${id}/live-score`,
      ),
  },

  leaderboard: {
    global: (limit = 50) =>
      apiFetch<{ mode: string; entries: GlobalLeaderboardEntry[] }>(
        `/api/leaderboard?limit=${limit}`,
      ),
    byMode: (mode: GameMode, limit = 50) =>
      apiFetch<{ mode: string; entries: GlobalLeaderboardEntry[] }>(
        `/api/leaderboard?mode=${mode}&limit=${limit}`,
      ),
    forInstance: (id: string) =>
      apiFetch<{ instance_id: string; players: InstancePlayer[] }>(
        `/api/leaderboard/instance/${id}`,
      ),
  },

  conversion: {
    track: (data: {
      event_type: string;
      partner_id?: string;
      template_id?: string;
      instance_id?: string;
      percentile?: number;
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<{ event: ConversionEvent }>('/api/conversion', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  partner: {
    stats: () =>
      apiFetch<{
        summary: {
          templates_created: number;
          total_instances: number;
          total_players_reached: number;
          total_conversions: number;
          conversion_rate: number;
        };
        daily_conversions: Array<{ day: string; count: number }>;
        template_performance: Array<{
          template_id: string;
          template_name: string;
          game_mode: string;
          play_count: number;
          player_count: number;
          conversions: number;
        }>;
        funnel: Array<{ event_type: string; count: number }>;
        referrals?: {
          total_clicks: number;
          unique_players: number;
          by_source: Array<{ source: string; count: number }>;
        };
      }>('/api/partner/stats'),
  },

  admin: {
    stats: () => apiFetch<AdminStats>('/api/admin/stats'),
    partners: () => apiFetch<{ partners: PartnerStats[] }>('/api/admin/partners'),
    players: () => apiFetch<{ players: ArenaUser[] }>('/api/admin/players'),
    funnel: () =>
      apiFetch<{
        funnel: Array<{ event_type: string; count: number }>;
        daily_conversions: Array<{ day: string; count: number }>;
      }>('/api/admin/funnel'),
  },

  migrate: () =>
    apiFetch<{ success: boolean; log: string[] }>('/api/migrate', {
      method: 'POST',
    }),
};
