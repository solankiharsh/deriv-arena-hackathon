import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { queryOne, execute } from '@/lib/db/postgres';
import { createSession } from '@/lib/auth/session';
import type { ArenaUser } from '@/lib/arena-types';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const origin = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).trim();

  if (error) {
    const desc = url.searchParams.get('error_description') || error;
    console.warn(`[auth/callback] OAuth error: ${desc}`);
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`);
  }

  if (!code || !state) {
    console.warn('[auth/callback] Missing code or state params');
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  if (state !== storedState) {
    console.warn('[auth/callback] State mismatch — possible CSRF');
    return NextResponse.redirect(`${origin}/login?error=state_mismatch`);
  }

  const codeVerifier = cookieStore.get('pkce_verifier')?.value;
  if (!codeVerifier) {
    console.warn('[auth/callback] Missing code_verifier cookie');
    return NextResponse.redirect(`${origin}/login?error=missing_verifier`);
  }

  cookieStore.delete('pkce_verifier');
  cookieStore.delete('oauth_state');

  const clientId = (process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.DERIV_APP_ID || '').trim();
  if (!clientId) {
    return NextResponse.redirect(`${origin}/login?error=no_app_id`);
  }

  const redirectUri = `${origin}/api/auth/callback`;

  let accessToken: string;
  try {
    const tokenRes = await fetch('https://auth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('[auth/callback] Token exchange failed:', tokenRes.status, errBody);
      return NextResponse.redirect(`${origin}/login?error=token_exchange_failed`);
    }

    const tokenData = await tokenRes.json();
    accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('[auth/callback] No access_token in response');
      return NextResponse.redirect(`${origin}/login?error=no_token`);
    }

    console.log('[auth/callback] Token exchange succeeded');
  } catch (err) {
    console.error('[auth/callback] Token exchange error:', err);
    return NextResponse.redirect(`${origin}/login?error=token_exchange_failed`);
  }

  let derivAccountId = '';
  let demoAccountId = '';
  try {
    const accountsRes = await fetch(
      'https://api.derivws.com/trading/v1/options/accounts',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Deriv-App-ID': clientId,
          'Content-Type': 'application/json',
        },
      },
    );

    if (accountsRes.ok) {
      const accountsData = await accountsRes.json();
      console.log('[auth/callback] Accounts response:', JSON.stringify(accountsData).slice(0, 500));

      const accounts: Array<{ id?: string; loginid?: string; account_type?: string; is_virtual?: boolean; currency?: string }> =
        accountsData.data?.accounts || accountsData.accounts || accountsData.data || [];

      if (Array.isArray(accounts) && accounts.length > 0) {
        const demo = accounts.find(
          (a) => a.account_type === 'demo' || a.is_virtual === true ||
                 (a.loginid || a.id || '').toLowerCase().startsWith('vrtc') ||
                 (a.loginid || a.id || '').toLowerCase().startsWith('vrw'),
        );
        const primary = accounts[0];
        derivAccountId = (demo || primary).loginid || (demo || primary).id || '';
        demoAccountId = demo ? (demo.loginid || demo.id || '') : '';
      }
    } else {
      console.warn('[auth/callback] Accounts fetch failed:', accountsRes.status);
    }
  } catch (err) {
    console.warn('[auth/callback] Accounts fetch error:', err);
  }

  if (!derivAccountId) {
    derivAccountId = `deriv-${Date.now()}`;
    console.log(`[auth/callback] No account ID from API, using fallback: ${derivAccountId}`);
  }

  const loginId = derivAccountId;
  console.log(`[auth/callback] Using derivAccountId=${derivAccountId}, demoAccountId=${demoAccountId}`);

  let user: ArenaUser | null;
  try {
    user = await queryOne<ArenaUser>(
      'SELECT * FROM arena_users WHERE deriv_account_id = $1',
      [derivAccountId],
    );
  } catch (err) {
    console.error('[auth/callback] DB query failed:', err);
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
    return NextResponse.redirect(`${origin}/login?error=create_failed`);
  }

  const needsRole = user.role === 'player' && !isAdmin;

  await createSession({
    uid: user.id,
    did: user.deriv_account_id,
    role: user.role,
    name: user.display_name,
    dt: accessToken,
    da: demoAccountId || derivAccountId,
  });

  if (needsRole && user.total_games === 0) {
    console.log(`[auth/callback] Redirecting to role selection: user=${user.id}`);
    return NextResponse.redirect(`${origin}/login?step=role`);
  }

  console.log(`[auth/callback] Login complete: user=${user.id}, role=${user.role}`);
  return NextResponse.redirect(`${origin}/arena`);
}
