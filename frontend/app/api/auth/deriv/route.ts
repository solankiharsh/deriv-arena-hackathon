import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export async function GET() {
  const clientId = (process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.DERIV_APP_ID || '').trim();
  if (!clientId) {
    return NextResponse.json({ error: 'DERIV_APP_ID not configured' }, { status: 500 });
  }

  // NEXT_PUBLIC_BASE_URL is the canonical production URL (set in Vercel env vars).
  // Fall back to VERCEL_URL (auto-injected per-deployment) then localhost.
  const origin = (
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).trim();
  const redirectUri = `${origin}/api/auth/callback`;

  const codeVerifier = crypto.randomBytes(48).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  const state = crypto.randomBytes(16).toString('hex');

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 600,
    path: '/',
  };
  cookieStore.set('pkce_verifier', codeVerifier, cookieOpts);
  cookieStore.set('oauth_state', state, cookieOpts);

  const oauthUrl = new URL('https://auth.deriv.com/oauth2/auth');
  oauthUrl.searchParams.set('response_type', 'code');
  oauthUrl.searchParams.set('client_id', clientId);
  oauthUrl.searchParams.set('redirect_uri', redirectUri);
  oauthUrl.searchParams.set('scope', 'trade account_manage');
  oauthUrl.searchParams.set('state', state);
  oauthUrl.searchParams.set('code_challenge', codeChallenge);
  oauthUrl.searchParams.set('code_challenge_method', 'S256');

  return NextResponse.redirect(oauthUrl.toString());
}
