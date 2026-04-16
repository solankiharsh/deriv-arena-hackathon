import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const funnel = await query<{ event_type: string; count: string }>(`
    SELECT event_type, COUNT(*) as count
    FROM conversion_events
    GROUP BY event_type
    ORDER BY
      CASE event_type
        WHEN 'signup_click' THEN 1
        WHEN 'redirect' THEN 2
        WHEN 'registration' THEN 3
        WHEN 'first_trade' THEN 4
      END
  `);

  const dailyConversions = await query<{ day: string; count: string }>(`
    SELECT DATE(created_at) as day, COUNT(*) as count
    FROM conversion_events
    WHERE created_at > now() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY day
  `);

  return NextResponse.json({
    funnel: funnel.map(f => ({
      event_type: f.event_type,
      count: parseInt(f.count, 10),
    })),
    daily_conversions: dailyConversions.map(d => ({
      day: d.day,
      count: parseInt(d.count, 10),
    })),
  });
}
