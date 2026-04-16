import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { AdminStats } from '@/lib/arena-types';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const stats = await queryOne<{
    total_players: string;
    total_partners: string;
    total_templates: string;
    total_instances: string;
    active_instances: string;
    total_conversions: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM arena_users WHERE role = 'player') as total_players,
      (SELECT COUNT(*) FROM arena_users WHERE role = 'partner') as total_partners,
      (SELECT COUNT(*) FROM game_templates) as total_templates,
      (SELECT COUNT(*) FROM game_instances) as total_instances,
      (SELECT COUNT(*) FROM game_instances WHERE status = 'live') as active_instances,
      (SELECT COUNT(*) FROM conversion_events) as total_conversions
  `);

  const topPartner = await queryOne<{ display_name: string; conversions: string }>(`
    SELECT u.display_name, COUNT(ce.id) as conversions
    FROM conversion_events ce
    JOIN arena_users u ON u.id = ce.partner_id
    WHERE ce.partner_id IS NOT NULL
    GROUP BY u.id, u.display_name
    ORDER BY conversions DESC
    LIMIT 1
  `);

  const totalPlayers = parseInt(stats?.total_players || '0', 10);
  const totalConversions = parseInt(stats?.total_conversions || '0', 10);

  const result: AdminStats = {
    total_players: totalPlayers,
    total_partners: parseInt(stats?.total_partners || '0', 10),
    total_templates: parseInt(stats?.total_templates || '0', 10),
    total_instances: parseInt(stats?.total_instances || '0', 10),
    active_instances: parseInt(stats?.active_instances || '0', 10),
    total_conversions: totalConversions,
    conversion_rate: totalPlayers > 0 ? (totalConversions / totalPlayers) * 100 : 0,
    top_partner: topPartner
      ? { name: topPartner.display_name, conversions: parseInt(topPartner.conversions, 10) }
      : null,
  };

  return NextResponse.json(result);
}
