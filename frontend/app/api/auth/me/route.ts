import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/postgres';
import type { ArenaUser } from '@/lib/arena-types';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  try {
    const user = await queryOne<ArenaUser>(
      'SELECT * FROM arena_users WHERE id = $1',
      [session.uid],
    );

    if (!user) {
      console.warn(`[auth/me] Session valid but user not found in DB: uid=${session.uid}`);
      return NextResponse.json({ user: null }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error(`[auth/me] DB query failed for uid=${session.uid}:`, err);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
