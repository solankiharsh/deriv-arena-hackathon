import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { GameInstance, InstancePlayer } from '@/lib/arena-types';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const instance = await queryOne<GameInstance>(
    'SELECT * FROM game_instances WHERE id = $1',
    [id],
  );

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  if (instance.status !== 'waiting' && instance.status !== 'live') {
    return NextResponse.json({ error: 'Cannot join a finished game' }, { status: 400 });
  }

  const existing = await queryOne<InstancePlayer>(
    'SELECT * FROM instance_players WHERE instance_id = $1 AND user_id = $2',
    [id, session.uid],
  );

  if (existing) {
    return NextResponse.json({ player: existing, already_joined: true });
  }

  const player = await queryOne<InstancePlayer>(
    `INSERT INTO instance_players (instance_id, user_id)
     VALUES ($1, $2)
     RETURNING *`,
    [id, session.uid],
  );

  await execute(
    'UPDATE game_instances SET player_count = player_count + 1 WHERE id = $1',
    [id],
  );

  return NextResponse.json({ player, already_joined: false }, { status: 201 });
}
