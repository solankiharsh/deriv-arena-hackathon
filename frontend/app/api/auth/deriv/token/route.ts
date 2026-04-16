import { NextRequest, NextResponse } from 'next/server';

const TOKEN_URL = 'https://auth.deriv.com/oauth2/token';

const MAX_CODE_LEN = 2048;
const MAX_VERIFIER_LEN = 256;
const MIN_VERIFIER_LEN = 43;

function isReasonableOAuthCode(s: string): boolean {
  return /^[\w.-]+$/.test(s) && s.length <= MAX_CODE_LEN;
}

function isReasonableCodeVerifier(s: string): boolean {
  return s.length >= MIN_VERIFIER_LEN && s.length <= MAX_VERIFIER_LEN && /^[\w.-~]+$/.test(s);
}

function collectAllowedRedirectUris(): Set<string> {
  const out = new Set<string>();
  const add = (s: string | undefined) => {
    const t = s?.trim();
    if (t) out.add(t);
  };
  add(process.env.DERIV_OAUTH_REDIRECT_URI);
  /** Same value is often duplicated for the browser bundle — accept either on the server. */
  add(process.env.NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI);
  const csv = process.env.DERIV_OAUTH_REDIRECT_URI_ALLOWLIST;
  if (csv) {
    for (const part of csv.split(',')) add(part);
  }
  return out;
}

function isAllowedRedirectUri(uri: string): boolean {
  const allowed = collectAllowedRedirectUris();
  if (allowed.size === 0) return false;
  return allowed.has(uri.trim());
}

/**
 * Step 4 — server-side authorization_code + PKCE token exchange (Deriv docs).
 * POST JSON: { code, code_verifier, redirect_uri }
 *
 * Requires `DERIV_OAUTH_CLIENT_ID` and at least one of:
 * `DERIV_OAUTH_REDIRECT_URI`, `NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI`, or
 * `DERIV_OAUTH_REDIRECT_URI_ALLOWLIST` (comma-separated exact URLs).
 *
 * Next.js reads `frontend/.env.local` (not the monorepo root `.env`). Put the same
 * redirect URL there as in the Deriv dashboard and in `NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI`.
 */
export async function POST(req: NextRequest) {
  const clientId = (process.env.DERIV_OAUTH_CLIENT_ID || '').trim();
  if (!clientId) {
    return NextResponse.json(
      { error: 'Server is not configured for Deriv OAuth (missing DERIV_OAUTH_CLIENT_ID).' },
      { status: 503 },
    );
  }
  if (collectAllowedRedirectUris().size === 0) {
    return NextResponse.json(
      {
        error:
          'Server missing redirect allowlist (set DERIV_OAUTH_REDIRECT_URI or NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI in frontend/.env.local).',
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { code, code_verifier: codeVerifier, redirect_uri: redirectUri } = body as Record<
    string,
    unknown
  >;

  if (typeof code !== 'string' || typeof codeVerifier !== 'string' || typeof redirectUri !== 'string') {
    return NextResponse.json({ error: 'Missing code, code_verifier, or redirect_uri' }, { status: 400 });
  }

  if (!isReasonableOAuthCode(code) || !isReasonableCodeVerifier(codeVerifier)) {
    return NextResponse.json({ error: 'Invalid parameter format' }, { status: 400 });
  }

  if (!isAllowedRedirectUri(redirectUri)) {
    return NextResponse.json({ error: 'redirect_uri is not allowed' }, { status: 400 });
  }

  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });

  let tokenRes: Response;
  try {
    tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
  } catch {
    return NextResponse.json({ error: 'Token request failed' }, { status: 502 });
  }

  const text = await tokenRes.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid token response' }, { status: 502 });
  }

  if (!tokenRes.ok) {
    const err = parsed as { error?: string; error_description?: string };
    return NextResponse.json(
      {
        error: 'Token exchange rejected',
        details: err.error || 'unknown',
        description: err.error_description,
      },
      { status: 400 },
    );
  }

  const data = parsed as {
    access_token?: string;
    expires_in?: number;
    token_type?: string;
    refresh_token?: string;
  };

  if (!data.access_token) {
    return NextResponse.json({ error: 'Missing access_token in response' }, { status: 502 });
  }

  return NextResponse.json({
    access_token: data.access_token,
    expires_in: data.expires_in ?? 3600,
    token_type: data.token_type ?? 'Bearer',
    refresh_token: data.refresh_token,
  });
}
