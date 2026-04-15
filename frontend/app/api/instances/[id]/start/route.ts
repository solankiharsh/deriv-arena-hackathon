import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { GameInstance, GameTemplate } from '@/lib/arena-types';

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
    return NextResponse.json({ error: 'Only the creator can start the game' }, { status: 403 });
  }

  if (instance.status !== 'waiting') {
    return NextResponse.json({ error: 'Game already started or finished' }, { status: 400 });
  }

  const template = await queryOne<GameTemplate>(
    'SELECT * FROM game_templates WHERE id = $1',
    [instance.template_id],
  );

  const config = template?.config
    ? (typeof template.config === 'string' ? JSON.parse(template.config) : template.config)
    : {};
  const durationMinutes = config.duration_minutes || 15;
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  await execute(
    `UPDATE game_instances SET status = 'live', started_at = $1, ends_at = $2 WHERE id = $3`,
    [now.toISOString(), endsAt.toISOString(), id],
  );

  return NextResponse.json({
    success: true,
    started_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
  });
}
