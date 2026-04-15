import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'partner' && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const partnerId = session.uid;

  try {
    const counts = await queryOne<{
      templates_created: string;
      total_instances: string;
      total_players_reached: string;
      total_conversions: string;
    }>(`
      SELECT
        (SELECT COUNT(*) FROM game_templates WHERE created_by = $1) as templates_created,
        (SELECT COUNT(*) FROM game_instances gi
           JOIN game_templates t ON t.id = gi.template_id
           WHERE t.created_by = $1) as total_instances,
        (SELECT COUNT(DISTINCT ip.user_id) FROM instance_players ip
           JOIN game_instances gi ON gi.id = ip.instance_id
           JOIN game_templates t ON t.id = gi.template_id
           WHERE t.created_by = $1) as total_players_reached,
        (SELECT COUNT(*) FROM conversion_events WHERE partner_id = $1) as total_conversions
    `, [partnerId]);

    const templatesCreated = parseInt(counts?.templates_created || '0', 10);
    const totalInstances = parseInt(counts?.total_instances || '0', 10);
    const totalPlayersReached = parseInt(counts?.total_players_reached || '0', 10);
    const totalConversions = parseInt(counts?.total_conversions || '0', 10);
    const conversionRate = totalPlayersReached > 0
      ? (totalConversions / totalPlayersReached) * 100
      : 0;

    const dailyConversions = await query<{ day: string; count: string }>(`
      SELECT DATE(created_at) as day, COUNT(*) as count
      FROM conversion_events
      WHERE partner_id = $1 AND created_at > now() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY day
    `, [partnerId]);

    const templatePerformance = await query<{
      template_id: string;
      template_name: string;
      game_mode: string;
      play_count: string;
      player_count: string;
      conversions: string;
    }>(`
      SELECT
        t.id as template_id,
        t.name as template_name,
        t.game_mode,
        (SELECT COUNT(*) FROM game_instances WHERE template_id = t.id) as play_count,
        (SELECT COUNT(DISTINCT ip.user_id) FROM instance_players ip
           JOIN game_instances gi ON gi.id = ip.instance_id
           WHERE gi.template_id = t.id) as player_count,
        (SELECT COUNT(*) FROM conversion_events WHERE template_id = t.id) as conversions
      FROM game_templates t
      WHERE t.created_by = $1
      ORDER BY conversions DESC
    `, [partnerId]);

    const funnel = await query<{ event_type: string; count: string }>(`
      SELECT event_type, COUNT(*) as count
      FROM conversion_events
      WHERE partner_id = $1
      GROUP BY event_type
      ORDER BY
        CASE event_type
          WHEN 'signup_click' THEN 1
          WHEN 'redirect' THEN 2
          WHEN 'registration' THEN 3
          WHEN 'first_trade' THEN 4
        END
    `, [partnerId]);

    const referralBySource = await query<{ source: string; count: string }>(`
      SELECT source, COUNT(*) as count
      FROM partner_referral_clicks
      WHERE partner_id = $1
      GROUP BY source
      ORDER BY count DESC
    `, [partnerId]).catch(() => []);

    const referralSummary = await queryOne<{
      total_clicks: string;
      unique_players: string;
    }>(`
      SELECT
        COUNT(*) as total_clicks,
        COUNT(DISTINCT user_id) as unique_players
      FROM partner_referral_clicks
      WHERE partner_id = $1
    `, [partnerId]).catch(() => null);

    return NextResponse.json({
      summary: {
        templates_created: templatesCreated,
        total_instances: totalInstances,
        total_players_reached: totalPlayersReached,
        total_conversions: totalConversions,
        conversion_rate: conversionRate,
      },
      daily_conversions: dailyConversions.map(d => ({
        day: d.day,
        count: parseInt(d.count, 10),
      })),
      template_performance: templatePerformance.map(tp => ({
        template_id: tp.template_id,
        template_name: tp.template_name,
        game_mode: tp.game_mode,
        play_count: parseInt(tp.play_count, 10),
        player_count: parseInt(tp.player_count, 10),
        conversions: parseInt(tp.conversions, 10),
      })),
      funnel: funnel.map(f => ({
        event_type: f.event_type,
        count: parseInt(f.count, 10),
      })),
      referrals: {
        total_clicks: parseInt(referralSummary?.total_clicks || '0', 10),
        unique_players: parseInt(referralSummary?.unique_players || '0', 10),
        by_source: referralBySource.map(r => ({
          source: r.source,
          count: parseInt(r.count, 10),
        })),
      },
    });
  } catch (err) {
    console.error('Partner stats query failed:', err);
    return NextResponse.json(
      { error: 'Failed to load partner statistics' },
      { status: 500 },
    );
  }
}
