import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { GameTemplate } from '@/lib/arena-types';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templates = await query<GameTemplate>(
    `SELECT t.*, u.display_name as creator_name
     FROM game_templates t
     JOIN arena_users u ON u.id = t.created_by
     WHERE t.created_by = $1
     ORDER BY t.created_at DESC`,
    [session.uid],
  );

  return NextResponse.json({ templates });
}
