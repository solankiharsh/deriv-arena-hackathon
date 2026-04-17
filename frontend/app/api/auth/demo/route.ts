import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/postgres';
import { createSession } from '@/lib/auth/session';
import type { ArenaUser } from '@/lib/arena-types';
import type { UserRole } from '@/lib/arena-types';

const ACCOUNT_MAP: Record<string, { accountId: string; name: string; role: UserRole }> = {
  player:  { accountId: 'DEMO_P1',      name: 'Demo Player',  role: 'player' },
  partner: { accountId: 'DEMO_PARTNER', name: 'Demo Partner', role: 'partner' },
  admin:   { accountId: 'DEMO_ADMIN',   name: 'Demo Admin',   role: 'admin' },
};

// Synthetic in-memory users used when there is no database (no DATABASE_URL).
// This lets judges use demo login even without a connected Postgres instance.
const SYNTHETIC_USERS: Record<string, ArenaUser> = {
  DEMO_P1: {
    id: '00000000-0000-0000-0000-000000000001',
    deriv_account_id: 'DEMO_P1',
    deriv_login_id: 'DEMO_P1',
    display_name: 'Demo Player',
    avatar_url: null,
    role: 'player',
    arena_rating: 0,
    total_games: 0,
    total_wins: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  DEMO_PARTNER: {
    id: '00000000-0000-0000-0000-000000000002',
    deriv_account_id: 'DEMO_PARTNER',
    deriv_login_id: 'DEMO_PARTNER',
    display_name: 'Demo Partner',
    avatar_url: null,
    role: 'partner',
    arena_rating: 0,
    total_games: 0,
    total_wins: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  DEMO_ADMIN: {
    id: '00000000-0000-0000-0000-000000000003',
    deriv_account_id: 'DEMO_ADMIN',
    deriv_login_id: 'DEMO_ADMIN',
    display_name: 'Demo Admin',
    avatar_url: null,
    role: 'admin',
    arena_rating: 0,
    total_games: 0,
    total_wins: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

function isDemoLoginEnabled(): boolean {
  const flag = (process.env.DEMO_LOGIN_ENABLED ?? '').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;

  if (process.env.ALLOW_DEMO_LOGIN) return true;

  return process.env.NODE_ENV !== 'production' || !!process.env.VERCEL_ENV;
}

export async function POST(req: NextRequest) {
  if (!isDemoLoginEnabled()) {
    console.warn('[auth/demo] Blocked: demo login disabled (set DEMO_LOGIN_ENABLED=1 or ALLOW_DEMO_LOGIN=1 to enable)');
    return NextResponse.json({ error: 'Demo login disabled in production' }, { status: 403 });
  }

  let body: { role?: string };
  try {
    body = await req.json();
  } catch (err) {
    console.error('[auth/demo] Failed to parse request body:', err);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { role } = body;
  const mapping = ACCOUNT_MAP[role ?? ''] || ACCOUNT_MAP.player;
  const { accountId } = mapping;
  console.log(`[auth/demo] Demo login: role=${role}, accountId=${accountId}`);

  const hasDb = !!process.env.DATABASE_URL;
  let user: ArenaUser | null = null;

  if (hasDb) {
    try {
      user = await queryOne<ArenaUser>(
        'SELECT * FROM arena_users WHERE deriv_account_id = $1',
        [accountId],
      );

      if (!user) {
        // Auto-seed this demo user on first use
        user = await queryOne<ArenaUser>(
          `INSERT INTO arena_users (deriv_account_id, deriv_login_id, display_name, role)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (deriv_account_id) DO UPDATE SET updated_at = now()
           RETURNING *`,
          [accountId, accountId, mapping.name, mapping.role],
        );
      }
    } catch (err) {
      console.error(`[auth/demo] DB error for accountId=${accountId}:`, err);
      // Fall through to synthetic user
    }
  }

  // No DB or DB failed — use synthetic in-memory user
  if (!user) {
    console.log(`[auth/demo] Using synthetic user for accountId=${accountId}`);
    user = SYNTHETIC_USERS[accountId] ?? SYNTHETIC_USERS.DEMO_P1;
  }

  try {
    await createSession({
      uid: user.id,
      did: user.deriv_account_id,
      role: user.role,
      name: user.display_name,
    });
  } catch (err) {
    console.error(`[auth/demo] Failed to create session:`, err);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  console.log(`[auth/demo] Success: user=${user.id}, role=${user.role}`);
  return NextResponse.json({ user });
}

