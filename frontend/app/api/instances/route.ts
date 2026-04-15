import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { GameInstance, GameTemplate } from '@/lib/arena-types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const templateId = searchParams.get('template_id');

  let sql = `
    SELECT gi.*, 
           t.name as template_name, t.game_mode, t.config as template_config,
           u.display_name as starter_name
    FROM game_instances gi
    JOIN game_templates t ON t.id = gi.template_id
    JOIN arena_users u ON u.id = gi.started_by
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    sql += ` AND gi.status = $${params.length}`;
  }
  if (templateId) {
    params.push(templateId);
    sql += ` AND gi.template_id = $${params.length}`;
  }

  sql += ' ORDER BY gi.created_at DESC LIMIT 50';

  const instances = await query<GameInstance & { template_name: string; game_mode: string }>(sql, params);
  return NextResponse.json({ instances });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { template_slug } = body;

  if (!template_slug) {
    return NextResponse.json({ error: 'template_slug is required' }, { status: 400 });
  }

  const template = await queryOne<GameTemplate>(
    'SELECT * FROM game_templates WHERE slug = $1 AND is_active = true',
    [template_slug],
  );

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const config = typeof template.config === 'string' ? JSON.parse(template.config) : template.config;
  const durationMinutes = config.duration_minutes || 15;
  const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const instance = await queryOne<GameInstance>(
    `INSERT INTO game_instances (template_id, template_slug, started_by, status, ends_at)
     VALUES ($1, $2, $3, 'waiting', $4)
     RETURNING *`,
    [template.id, template.slug, session.uid, endsAt.toISOString()],
  );

  await execute(
    'UPDATE game_templates SET play_count = play_count + 1, updated_at = now() WHERE id = $1',
    [template.id],
  );

  return NextResponse.json({ instance }, { status: 201 });
}
