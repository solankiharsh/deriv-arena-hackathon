import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import type { InstancePlayer } from '@/lib/arena-types';

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

  return NextResponse.json({
    instance_id: id,
    players: players.map((p, i) => ({ ...p, rank: i + 1 })),
  });
}
