import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPublicOrigin } from '@/lib/auth/public-origin';

/**
 * Initiates the Deriv OAuth2 flow with PKCE.
 *
 * Implementation notes:
 *  - Cookies are set on the `NextResponse` directly (not via `cookies().set()`),
 *    because in Next.js App Router route handlers, cookies written through the
 *    `next/headers` API are not reliably attached to a `NextResponse.redirect(...)`
 *    response — the browser never stores them, which shows up downstream as
 *    `oauth_state` missing on the callback and a `state_mismatch` error.
 *  - `pkce_verifier` and `oauth_state` are single-use; the callback deletes
 *    them after successful verification.
 */
export async function GET(req: NextRequest) {
  const clientId = (process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.DERIV_APP_ID || '').trim();
  if (!clientId) {
    return NextResponse.json({ error: 'DERIV_APP_ID not configured' }, { status: 500 });
  }

  const origin = getPublicOrigin(req);
  const redirectUri = `${origin}/api/auth/callback`;

  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');

  const oauthUrl = new URL('https://auth.deriv.com/oauth2/auth');
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('client_id', clientId);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('scope', 'trade account_manage');
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('code_challenge', codeChallenge);
  oauthUrl.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.redirect(oauthUrl.toString());

  // 15 minutes is enough for slow account pickers / MFA while still scoping
  // the verifier/state cookies to a single login session.
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 15 * 60,
    path: '/',
  };

  res.cookies.set('pkce_verifier', codeVerifier, cookieOpts);
  res.cookies.set('oauth_state', state, cookieOpts);

  return res;
}
