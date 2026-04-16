import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { InstancePlayer } from '@/lib/arena-types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { score, pnl, trades_count, behavioral_score, metadata } = body;

  await execute(
    `UPDATE instance_players
     SET score = $1, pnl = $2, trades_count = $3, behavioral_score = $4, is_active = true
     WHERE instance_id = $5 AND user_id = $6`,
    [score ?? 0, pnl ?? 0, trades_count ?? 0, behavioral_score ?? 0, id, session.uid],
  );

  const allPlayers = await query<InstancePlayer>(
    'SELECT * FROM instance_players WHERE instance_id = $1 ORDER BY score DESC',
    [id],
  );

  const totalPlayers = allPlayers.length;
  let playerRank = 1;
  for (let i = 0; i < allPlayers.length; i++) {
    if (allPlayers[i].user_id === session.uid) {
      playerRank = i + 1;
      break;
    }
  }

  const percentile = totalPlayers > 1
    ? ((totalPlayers - playerRank) / (totalPlayers - 1)) * 100
    : 100;

  const normalizedScore = totalPlayers > 0
    ? Math.min(100, Math.max(0, percentile))
    : 50;

  await execute(
    `UPDATE instance_players SET normalized_score = $1, rank = $2 WHERE instance_id = $3 AND user_id = $4`,
    [normalizedScore, playerRank, id, session.uid],
  );

  await queryOne(
    `INSERT INTO game_scores (instance_id, user_id, raw_score, normalized_score, pnl, trade_count, behavioral_score, percentile, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [id, session.uid, score ?? 0, normalizedScore, pnl ?? 0, trades_count ?? 0, behavioral_score ?? 0, percentile, JSON.stringify(metadata || {})],
  );

  const surpassed85 = percentile >= 85 && totalPlayers >= 3;

  return NextResponse.json({
    rank: playerRank,
    total_players: totalPlayers,
    percentile: Math.round(percentile * 100) / 100,
    normalized_score: normalizedScore,
    surpassed_85: surpassed85,
    leaderboard: allPlayers.slice(0, 10).map((p, i) => ({
      user_id: p.user_id,
      score: p.score,
      pnl: p.pnl,
      rank: i + 1,
    })),
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const players = await query<InstancePlayer & { display_name: string; avatar_url: string | null }>(
    `SELECT ip.*, u.display_name, u.avatar_url
     FROM instance_players ip
     JOIN arena_users u ON u.id = ip.user_id
     WHERE ip.instance_id = $1
     ORDER BY ip.score DESC`,
    [id],
  );

  return NextResponse.json({ players });
}
