import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { awardFirstLogin } from '@/lib/miles/xp';

/**
 * POST /api/miles/starter/welcome
 *
 * Self-service fallback for users who signed in **before** the welcome bonus
 * was wired into /api/auth/callback and /api/auth/demo. New sign-ins already
 * get this reward automatically — this endpoint only succeeds the first time
 * for the calling user; repeat calls return `awarded: false, reason: 'duplicate'`
 * thanks to the (source_type, source_id) unique index on miles transactions.
 *
 * Response shape matches the other starter helpers:
 *   { ok: true, result: AwardResult }
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await awardFirstLogin(session.uid);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error(`[miles/starter/welcome] award failed user=${session.uid}:`, err);
    return NextResponse.json({ error: 'Award failed' }, { status: 500 });
  }
}
