import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
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
    const sourceFunnels = await query<{
      source: string;
      clicks: string;
      signups: string;
      redirects: string;
      registrations: string;
      first_trades: string;
    }>(`
      SELECT
        r.source,
        COUNT(DISTINCT r.id) AS clicks,
        COUNT(DISTINCT CASE WHEN ce.event_type = 'signup_click'  THEN ce.user_id END) AS signups,
        COUNT(DISTINCT CASE WHEN ce.event_type = 'redirect'      THEN ce.user_id END) AS redirects,
        COUNT(DISTINCT CASE WHEN ce.event_type = 'registration'  THEN ce.user_id END) AS registrations,
        COUNT(DISTINCT CASE WHEN ce.event_type = 'first_trade'   THEN ce.user_id END) AS first_trades
      FROM partner_referral_clicks r
      LEFT JOIN arena_conversion_events ce
        ON ce.partner_id = r.partner_id AND ce.user_id = r.user_id
      WHERE r.partner_id = $1
      GROUP BY r.source
      ORDER BY clicks DESC
    `, [partnerId]);

    const recentJourneys = await query<{
      user_id: string;
      display_name: string;
      source: string;
      clicked_at: string;
      last_event: string;
      events_count: string;
    }>(`
      SELECT
        r.user_id,
        COALESCE(u.display_name, 'Anonymous') AS display_name,
        r.source,
        r.created_at AS clicked_at,
        COALESCE(
          (SELECT ce.event_type FROM arena_conversion_events ce
           WHERE ce.user_id = r.user_id AND ce.partner_id = r.partner_id
           ORDER BY ce.created_at DESC LIMIT 1),
          'click'
        ) AS last_event,
        (SELECT COUNT(*) FROM arena_conversion_events ce
         WHERE ce.user_id = r.user_id AND ce.partner_id = r.partner_id
        )::text AS events_count
      FROM partner_referral_clicks r
      LEFT JOIN arena_users u ON u.id = r.user_id
      WHERE r.partner_id = $1 AND r.user_id IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT 20
    `, [partnerId]);

    return NextResponse.json({
      sources: sourceFunnels.map(s => ({
        source: s.source,
        clicks: parseInt(s.clicks, 10),
        signups: parseInt(s.signups, 10),
        redirects: parseInt(s.redirects, 10),
        registrations: parseInt(s.registrations, 10),
        first_trades: parseInt(s.first_trades, 10),
      })),
      recent_journeys: recentJourneys.map(j => ({
        user_id: j.user_id,
        display_name: j.display_name,
        source: j.source,
        clicked_at: j.clicked_at,
        last_event: j.last_event,
        events_count: parseInt(j.events_count, 10),
      })),
    });
  } catch (err) {
    console.error('Referral journey query failed:', err);
    return NextResponse.json(
      { error: 'Failed to load referral journey data' },
      { status: 500 },
    );
  }
}
