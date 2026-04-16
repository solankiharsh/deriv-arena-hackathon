import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db/postgres';
import type { GameInstance, InstancePlayer, GameTemplate } from '@/lib/arena-types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const instance = await queryOne<GameInstance & { game_mode: string; template_name: string }>(
    `SELECT gi.*, t.name as template_name, t.game_mode, t.config as template_config,
            t.description as template_description, u.display_name as starter_name
     FROM game_instances gi
     JOIN game_templates t ON t.id = gi.template_id
     JOIN arena_users u ON u.id = gi.started_by
     WHERE gi.id = $1`,
    [id],
  );

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  const players = await query<InstancePlayer & { display_name: string; avatar_url: string | null }>(
    `SELECT ip.*, u.display_name, u.avatar_url
     FROM instance_players ip
     JOIN arena_users u ON u.id = ip.user_id
     WHERE ip.instance_id = $1
     ORDER BY ip.score DESC`,
    [id],
  );

  return NextResponse.json({ instance, players });
}
