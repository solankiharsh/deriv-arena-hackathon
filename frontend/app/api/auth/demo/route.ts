import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/postgres';
import { createSession } from '@/lib/auth/session';
import type { ArenaUser } from '@/lib/arena-types';

const ACCOUNT_MAP: Record<string, string> = {
  player: 'DEMO_P1',
  partner: 'DEMO_PARTNER',
  admin: 'DEMO_ADMIN',
};

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEMO_LOGIN) {
    console.warn('[auth/demo] Blocked: demo login disabled in production');
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
  const accountId = ACCOUNT_MAP[role ?? ''] || ACCOUNT_MAP.player;
  console.log(`[auth/demo] Attempting demo login: role=${role}, accountId=${accountId}`);

  let user: ArenaUser | null;
  try {
    user = await queryOne<ArenaUser>(
      'SELECT * FROM arena_users WHERE deriv_account_id = $1',
      [accountId],
    );
  } catch (err) {
    console.error(`[auth/demo] DB query failed for accountId=${accountId}:`, err);
    return NextResponse.json(
      { error: 'Database error. Have you run the migration? POST /api/migrate' },
      { status: 500 },
    );
  }

  if (!user) {
    console.warn(`[auth/demo] Demo user not found: accountId=${accountId}. Run POST /api/migrate to seed.`);
    return NextResponse.json(
      { error: 'Demo user not found. Run migration first: POST /api/migrate' },
      { status: 404 },
    );
  }

  try {
    await createSession({
      uid: user.id,
      did: user.deriv_account_id,
      role: user.role,
      name: user.display_name,
    });
  } catch (err) {
    console.error(`[auth/demo] Failed to create session for user=${user.id}:`, err);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }

  console.log(`[auth/demo] Success: user=${user.id}, role=${user.role}, name=${user.display_name}`);
  return NextResponse.json({ user });
}
