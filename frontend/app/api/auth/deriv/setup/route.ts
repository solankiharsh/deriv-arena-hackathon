import { NextResponse } from 'next/server';

/**
 * Dev helper: shows the exact `redirect_uri` this app sends to Deriv so you can paste it
 * into developers.deriv.com for the same OAuth `client_id`. Disabled in production.
 *
 * Open: GET /api/auth/deriv/setup (via your public URL, e.g. ngrok, or localhost).
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse(null, { status: 404 });
  }

  const nextPub = (process.env.NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI || '').trim();
  const serverOnly = (process.env.DERIV_OAUTH_REDIRECT_URI || '').trim();
  const redirectUri = nextPub || serverOnly;
  const clientId = (process.env.DERIV_OAUTH_CLIENT_ID || '').trim();

  return NextResponse.json({
    redirectUri: redirectUri || null,
    sources: { NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI: nextPub || null, DERIV_OAUTH_REDIRECT_URI: serverOnly || null },
    clientId: clientId || null,
    registerThisRedirectUriOnDeriv:
      'developers.deriv.com → OAuth2 app that owns this client_id → Redirect / callback URLs (exact string, including https and path).',
    troubleshooting: 'https://developers.deriv.com/docs/intro/oauth/',
    ngrokNote:
      'If you restarted ngrok, the hostname changes: update this URL in Deriv and in .env, then restart `next dev`.',
  });
}
