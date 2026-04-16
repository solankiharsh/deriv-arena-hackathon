import { NextRequest, NextResponse } from 'next/server';
import { queryOne, query } from '@/lib/db/postgres';
import type { GameTemplate, GameInstance } from '@/lib/arena-types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const template = await queryOne<GameTemplate>(
    `SELECT t.*, u.display_name as creator_name
     FROM game_templates t
     JOIN arena_users u ON u.id = t.created_by
     WHERE t.slug = $1`,
    [slug],
  );

  if (!template) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const instances = await query<GameInstance>(
    `SELECT gi.*, u.display_name as starter_name
     FROM game_instances gi
     JOIN arena_users u ON u.id = gi.started_by
     WHERE gi.template_id = $1
     ORDER BY gi.created_at DESC
     LIMIT 20`,
    [template.id],
  );

  return NextResponse.json({ template, instances });
}
