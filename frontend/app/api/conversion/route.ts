import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { ConversionEvent } from '@/lib/arena-types';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { event_type, partner_id, template_id, instance_id, percentile, metadata } = body;

  const validTypes = ['signup_click', 'redirect', 'registration', 'first_trade'];
  if (!validTypes.includes(event_type)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 });
  }

  const event = await queryOne<ConversionEvent>(
    `INSERT INTO arena_conversion_events (user_id, partner_id, template_id, instance_id, event_type, percentile_at_trigger, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      session.uid,
      partner_id || null,
      template_id || null,
      instance_id || null,
      event_type,
      percentile || 0,
      JSON.stringify(metadata || {}),
    ],
  );

  return NextResponse.json({ event }, { status: 201 });
}
