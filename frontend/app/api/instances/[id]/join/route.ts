import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { GameInstance, InstancePlayer } from '@/lib/arena-types';
import { awardFirstJoin, awardReferralJoin } from '@/lib/miles/xp';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_SOURCES = ['whatsapp', 'telegram', 'twitter', 'copy', 'direct'];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const referredBy = typeof body.referred_by === 'string' && UUID_RE.test(body.referred_by)
    ? body.referred_by
    : null;
  const source = VALID_SOURCES.includes(body.source) ? body.source : 'direct';

  const instance = await queryOne<GameInstance>(
    'SELECT * FROM game_instances WHERE id = $1',
    [id],
  );

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  if (instance.status !== 'waiting' && instance.status !== 'live') {
    return NextResponse.json({ error: 'Cannot join a finished game' }, { status: 400 });
  }

  const existing = await queryOne<InstancePlayer>(
    'SELECT * FROM instance_players WHERE instance_id = $1 AND user_id = $2',
    [id, session.uid],
  );

  if (existing) {
    return NextResponse.json({ player: existing, already_joined: true });
  }

  const player = await queryOne<InstancePlayer>(
    `INSERT INTO instance_players (instance_id, user_id, referred_by)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, session.uid, referredBy],
  );

  await execute(
    'UPDATE game_instances SET player_count = player_count + 1 WHERE id = $1',
    [id],
  );

  if (referredBy) {
    await execute(
      `INSERT INTO partner_referral_clicks (partner_id, template_id, instance_id, user_id, source)
       VALUES ($1, $2, $3, $4, $5)`,
      [referredBy, instance.template_id, id, session.uid, source],
    ).catch(() => {});

    // Award the referrer once per unique joiner. Never fail the join flow if
    // miles bookkeeping blows up — it's a secondary side-effect.
    try {
      await awardReferralJoin(referredBy, session.uid);
    } catch (err) {
      console.warn(`[instances/join] awardReferralJoin failed referrer=${referredBy} joiner=${session.uid}:`, err);
    }
  }

  try {
    await awardFirstJoin(session.uid);
  } catch (err) {
    console.warn(`[instances/join] awardFirstJoin failed user=${session.uid}:`, err);
  }

  return NextResponse.json({ player, already_joined: false }, { status: 201 });
}
