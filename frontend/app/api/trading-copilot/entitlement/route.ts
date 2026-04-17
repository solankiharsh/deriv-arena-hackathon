'use strict';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getTradingCopilotEntitlement } from '@/lib/trading-copilot/entitlements';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const ent = await getTradingCopilotEntitlement(session.uid);
  if (!ent.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: ent.reason,
      },
      { status: ent.reason === 'no_db' ? 503 : 403 },
    );
  }

  return NextResponse.json({
    ok: true,
    creditsRemaining: ent.creditsRemaining,
    expiresAt: ent.expiresAt,
  });
}
