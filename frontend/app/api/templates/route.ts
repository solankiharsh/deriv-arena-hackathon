import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { GameTemplate } from '@/lib/arena-types';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode');
  const featured = searchParams.get('featured');

  let sql = `
    SELECT t.*, u.display_name as creator_name
    FROM game_templates t
    JOIN arena_users u ON u.id = t.created_by
    WHERE t.is_active = true
  `;
  const params: unknown[] = [];

  if (mode) {
    params.push(mode);
    sql += ` AND t.game_mode = $${params.length}`;
  }

  if (featured === 'true') {
    sql += ' AND t.is_featured = true';
  }

  sql += ' ORDER BY t.is_featured DESC, t.play_count DESC, t.created_at DESC LIMIT 50';

  const templates = await query<GameTemplate>(sql, params);
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (session.role !== 'partner' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Only partners can create templates' }, { status: 403 });
  }

  const body = await req.json();
  const { name, description, game_mode, config } = body;

  if (!name || !game_mode) {
    return NextResponse.json({ error: 'Name and game_mode are required' }, { status: 400 });
  }

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);

  const template = await queryOne<GameTemplate>(
    `INSERT INTO game_templates (slug, name, description, game_mode, created_by, config)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [slug, name, description || '', game_mode, session.uid, JSON.stringify(config || {})],
  );

  return NextResponse.json({ template }, { status: 201 });
}
