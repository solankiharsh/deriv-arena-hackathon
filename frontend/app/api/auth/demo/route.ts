import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/postgres';
import { createSession } from '@/lib/auth/session';
import type { ArenaUser } from '@/lib/arena-types';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_DEMO_LOGIN) {
    return NextResponse.json({ error: 'Demo login disabled in production' }, { status: 403 });
  }

  const body = await req.json();
  const { role } = body;

  const accountMap: Record<string, string> = {
    player: 'DEMO_P1',
    partner: 'DEMO_PARTNER',
    admin: 'DEMO_ADMIN',
  };

  const accountId = accountMap[role] || accountMap.player;

  const user = await queryOne<ArenaUser>(
    'SELECT * FROM arena_users WHERE deriv_account_id = $1',
    [accountId],
  );

  if (!user) {
    return NextResponse.json({ error: 'Demo user not found. Run migration first.' }, { status: 404 });
  }

  await createSession({
    uid: user.id,
    did: user.deriv_account_id,
    role: user.role,
    name: user.display_name,
  });

  return NextResponse.json({ user });
}
