import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db/postgres';
import { createSession } from '@/lib/auth/session';
import type { ArenaUser } from '@/lib/arena-types';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  const acct1 = params.get('acct1');
  const token1 = params.get('token1');

  if (!acct1 || !token1) {
    const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  const derivAccountId = acct1;
  const loginId = params.get('cur1') || acct1;

  let user = await queryOne<ArenaUser>(
    'SELECT * FROM arena_users WHERE deriv_account_id = $1',
    [derivAccountId],
  );

  const adminIds = (process.env.ADMIN_DERIV_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isAdmin = adminIds.includes(derivAccountId);

  if (!user) {
    const role = isAdmin ? 'admin' : 'player';
    const displayName = `Trader-${derivAccountId.slice(-4)}`;

    user = await queryOne<ArenaUser>(
      `INSERT INTO arena_users (deriv_account_id, deriv_login_id, display_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [derivAccountId, loginId, displayName, role],
    );
  } else if (isAdmin && user.role !== 'admin') {
    await execute(
      'UPDATE arena_users SET role = $1, updated_at = now() WHERE id = $2',
      ['admin', user.id],
    );
    user.role = 'admin';
  }

  if (!user) {
    const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${origin}/login?error=create_failed`);
  }

  const needsRole = user.role === 'player' && !isAdmin;

  await createSession({
    uid: user.id,
    did: user.deriv_account_id,
    role: user.role,
    name: user.display_name,
  });

  const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  if (needsRole && user.total_games === 0) {
    return NextResponse.redirect(`${origin}/login?step=role`);
  }

  return NextResponse.redirect(`${origin}/arena`);
}
