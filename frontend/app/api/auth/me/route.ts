import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/postgres';
import type { ArenaUser } from '@/lib/arena-types';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const user = await queryOne<ArenaUser>(
    'SELECT * FROM arena_users WHERE id = $1',
    [session.uid],
  );

  if (!user) {
    return NextResponse.json({ user: null }, { status: 404 });
  }

  return NextResponse.json({ user });
}
