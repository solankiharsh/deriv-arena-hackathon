import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { awardShareLink } from '@/lib/miles/xp';

/**
 * POST /api/miles/starter/share-link
 *
 * Fires once per user the first time they share a competition link. This is
 * the only "starter" quest that doesn't have a natural server-side trigger,
 * so the share modal pings it after the user copies or posts their link.
 *
 * Body: { template_slug?: string }
 *
 * Idempotent: repeat calls return the `awarded: false, reason: 'duplicate'`
 * shape from `awardXP` without granting additional miles.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { template_slug?: unknown };
  const slug =
    typeof body.template_slug === 'string' && body.template_slug.length <= 128
      ? body.template_slug
      : 'unknown';

  try {
    const result = await awardShareLink(session.uid, slug);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error(`[miles/starter/share-link] award failed user=${session.uid}:`, err);
    return NextResponse.json({ error: 'Award failed' }, { status: 500 });
  }
}
