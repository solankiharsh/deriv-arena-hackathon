import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { PartnerStats } from '@/lib/arena-types';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const partners = await query<PartnerStats>(`
    SELECT
      u.id as partner_id,
      u.display_name,
      COUNT(DISTINCT t.id) as templates_created,
      COUNT(DISTINCT gi.id) as total_instances,
      COALESCE(SUM(gi.player_count), 0) as total_players_reached,
      COUNT(DISTINCT ce.id) as total_conversions,
      CASE
        WHEN COALESCE(SUM(gi.player_count), 0) > 0
        THEN (COUNT(DISTINCT ce.id)::numeric / SUM(gi.player_count) * 100)
        ELSE 0
      END as conversion_rate
    FROM arena_users u
    LEFT JOIN game_templates t ON t.created_by = u.id
    LEFT JOIN game_instances gi ON gi.template_id = t.id
    LEFT JOIN arena_conversion_events ce ON ce.partner_id = u.id
    WHERE u.role = 'partner'
    GROUP BY u.id, u.display_name
    ORDER BY total_conversions DESC
  `);

  return NextResponse.json({ partners });
}
