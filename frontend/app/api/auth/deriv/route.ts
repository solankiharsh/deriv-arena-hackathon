import { NextResponse } from 'next/server';

export async function GET() {
  const appId = process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.DERIV_APP_ID;
  if (!appId) {
    return NextResponse.json({ error: 'DERIV_APP_ID not configured' }, { status: 500 });
  }

  const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const redirectUri = `${origin}/api/auth/callback`;

  const oauthUrl = new URL('https://oauth.deriv.com/oauth2/authorize');
  oauthUrl.searchParams.set('app_id', appId);
  oauthUrl.searchParams.set('l', 'EN');
  oauthUrl.searchParams.set('brand', 'deriv');

  return NextResponse.redirect(oauthUrl.toString());
}
