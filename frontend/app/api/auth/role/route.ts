import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSession } from '@/lib/auth/session';
import { queryOne, execute } from '@/lib/db/postgres';
import type { ArenaUser, UserRole } from '@/lib/arena-types';

const VALID_ROLES: UserRole[] = ['player', 'partner'];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const role = body.role as UserRole;

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  await execute(
    'UPDATE arena_users SET role = $1, updated_at = now() WHERE id = $2',
    [role, session.uid],
  );

  const user = await queryOne<ArenaUser>(
    'SELECT * FROM arena_users WHERE id = $1',
    [session.uid],
  );

  if (user) {
    await createSession({
      uid: user.id,
      did: user.deriv_account_id,
      role: user.role,
      name: user.display_name,
    });
  }

  return NextResponse.json({ success: true, user });
}
