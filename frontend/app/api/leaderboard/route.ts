import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import type { GlobalLeaderboardEntry } from '@/lib/arena-types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

  if (mode) {
    const entries = await query<GlobalLeaderboardEntry>(
      `SELECT u.id as user_id, u.display_name, u.avatar_url, u.role,
              u.arena_rating, u.total_games as games_played,
              CASE WHEN u.total_games > 0 THEN (u.total_wins::numeric / u.total_games * 100) ELSE 0 END as win_rate,
              COALESCE(AVG(ip.normalized_score), 0) as score
       FROM arena_users u
       JOIN instance_players ip ON ip.user_id = u.id
       JOIN game_instances gi ON gi.id = ip.instance_id
       JOIN game_templates t ON t.id = gi.template_id
       WHERE t.game_mode = $1 AND gi.status = 'finished'
       GROUP BY u.id
       ORDER BY score DESC
       LIMIT $2`,
      [mode, limit],
    );

    return NextResponse.json({
      mode,
      entries: entries.map((e, i) => ({ ...e, rank: i + 1 })),
    });
  }

  const entries = await query<GlobalLeaderboardEntry>(
    `SELECT u.id as user_id, u.display_name, u.avatar_url, u.role,
            u.arena_rating, u.total_games as games_played,
            CASE WHEN u.total_games > 0 THEN (u.total_wins::numeric / u.total_games * 100) ELSE 0 END as win_rate,
            u.arena_rating as score
     FROM arena_users u
     WHERE u.total_games > 0
     ORDER BY u.arena_rating DESC
     LIMIT $1`,
    [limit],
  );

  return NextResponse.json({
    mode: 'global',
    entries: entries.map((e, i) => ({ ...e, rank: i + 1 })),
  });
}
