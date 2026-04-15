import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db/postgres';
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

  if (instance.started_by !== session.uid && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await execute(
    `UPDATE game_instances SET status = 'finished', finished_at = now() WHERE id = $1`,
    [id],
  );

  const players = await query<InstancePlayer>(
    'SELECT * FROM instance_players WHERE instance_id = $1 ORDER BY score DESC',
    [id],
  );

  for (let i = 0; i < players.length; i++) {
    const percentile = players.length > 1
      ? ((players.length - (i + 1)) / (players.length - 1)) * 100
      : 100;
    const normalized = Math.min(100, Math.max(0, percentile));

    await execute(
      'UPDATE instance_players SET rank = $1, normalized_score = $2 WHERE id = $3',
      [i + 1, normalized, players[i].id],
    );

    const ratingDelta = (normalized - 50) * 0.2;
    const isWin = i === 0 ? 1 : 0;

    await execute(
      `UPDATE arena_users
       SET arena_rating = GREATEST(0, arena_rating + $1),
           total_games = total_games + 1,
           total_wins = total_wins + $2,
           updated_at = now()
       WHERE id = $3`,
      [ratingDelta, isWin, players[i].user_id],
    );
  }

  return NextResponse.json({ success: true, final_rankings: players.length });
}
