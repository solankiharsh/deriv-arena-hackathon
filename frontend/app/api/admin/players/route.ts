import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { ArenaUser } from '@/lib/arena-types';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const players = await query<ArenaUser>(
    `SELECT * FROM arena_users
     ORDER BY arena_rating DESC, total_games DESC
     LIMIT 200`,
  );

  return NextResponse.json({ players });
}
