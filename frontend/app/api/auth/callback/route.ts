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
    console.warn('[auth/callback] Missing acct1 or token1 params');
    const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  const derivAccountId = acct1;
  const loginId = params.get('cur1') || acct1;
  console.log(`[auth/callback] OAuth callback: derivAccountId=${derivAccountId}`);

  let user: ArenaUser | null;
  try {
    user = await queryOne<ArenaUser>(
      'SELECT * FROM arena_users WHERE deriv_account_id = $1',
      [derivAccountId],
    );
  } catch (err) {
    console.error('[auth/callback] DB query failed:', err);
    const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    return NextResponse.redirect(`${origin}/login?error=create_failed`);
  }

  const adminIds = (process.env.ADMIN_DERIV_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  const isAdmin = adminIds.includes(derivAccountId);

  if (!user) {
    const role = isAdmin ? 'admin' : 'player';
    const displayName = `Trader-${derivAccountId.slice(-4)}`;
    console.log(`[auth/callback] New user, creating: role=${role}, name=${displayName}`);

    try {
      user = await queryOne<ArenaUser>(
        `INSERT INTO arena_users (deriv_account_id, deriv_login_id, display_name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [derivAccountId, loginId, displayName, role],
      );
    } catch (err) {
      console.error('[auth/callback] Failed to create user:', err);
      const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      return NextResponse.redirect(`${origin}/login?error=create_failed`);
    }
  } else if (isAdmin && user.role !== 'admin') {
    console.log(`[auth/callback] Promoting user to admin: id=${user.id}`);
    await execute(
      'UPDATE arena_users SET role = $1, updated_at = now() WHERE id = $2',
      ['admin', user.id],
    );
    user.role = 'admin';
  }

  if (!user) {
    console.error('[auth/callback] User creation returned null');
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
    console.log(`[auth/callback] Redirecting to role selection: user=${user.id}`);
    return NextResponse.redirect(`${origin}/login?step=role`);
  }

  console.log(`[auth/callback] Login complete: user=${user.id}, role=${user.role}`);
  return NextResponse.redirect(`${origin}/arena`);
}
