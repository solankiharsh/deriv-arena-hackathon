'use strict';

/**
 * Deriv OAuth 2.0 + PKCE (browser steps) — aligned with
 * https://developers.deriv.com/docs/intro/oauth/
 *
 * - Generate verifier / challenge / state, store in sessionStorage, then redirect.
 * - After callback, verify `state`, read `code`, exchange via POST /api/auth/deriv/token
 *   (never call auth.deriv.com/token from the browser with production patterns).
 *
 * **Redirect URI:** the string sent to Deriv as `redirect_uri` must match the app’s
 * registered URL exactly ([troubleshooting](https://developers.deriv.com/docs/intro/oauth/)).
 * Set `NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI` in `frontend/.env.local` to the same HTTPS URL
 * (e.g. ngrok `https://….ngrok-free.dev/callback`) and duplicate it as `DERIV_OAUTH_REDIRECT_URI`
 * there so the token route accepts it. Next.js does not load the monorepo root `.env` by default.
 */

const CHARSET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export const DERIV_OAUTH_STORAGE = {
  CODE_VERIFIER: 'pkce_code_verifier',
  STATE: 'oauth_state',
} as const;

export const DERIV_OAUTH_AUTHORIZE_URL = 'https://auth.deriv.com/oauth2/auth';

/**
 * Public callback URL — must match Deriv dashboard and server `DERIV_OAUTH_REDIRECT_URI`.
 * Prefer env so authorize + token exchange stay aligned.
 */
export function resolveDerivOAuthRedirectUri(override?: string): string {
  const fromEnv =
    typeof process !== 'undefined'
      ? (process.env.NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI || '').trim()
      : '';
  const u = (override ?? fromEnv).trim();
  if (!u) {
    throw new Error(
      'Deriv OAuth: set NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI in frontend/.env.local (same value as Deriv redirect + server DERIV_OAUTH_REDIRECT_URI), or pass redirectUri explicitly.',
    );
  }
  return u;
}

export type DerivOAuthPartnerParams = {
  sidc?: string;
  utm_campaign?: string;
  utm_medium?: string;
  utm_source?: string;
};

/** Step 1 — same algorithm as Deriv’s JavaScript snippet (verifier + S256 challenge + state). */
export async function generateDerivPkcePair(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}> {
  const array = crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = Array.from(array, (v) => CHARSET[v % 66]!).join('');

  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier),
  );
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

  return { codeVerifier, codeChallenge, state };
}

/** Step 4 storage tip — call immediately before `window.location.assign(authorizeUrl)`. */
export function storeDerivPkceSession(codeVerifier: string, state: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(DERIV_OAUTH_STORAGE.CODE_VERIFIER, codeVerifier);
  sessionStorage.setItem(DERIV_OAUTH_STORAGE.STATE, state);
}

export function readDerivPkceSession(): {
  codeVerifier: string | null;
  state: string | null;
} {
  if (typeof sessionStorage === 'undefined') {
    return { codeVerifier: null, state: null };
  }
  return {
    codeVerifier: sessionStorage.getItem(DERIV_OAUTH_STORAGE.CODE_VERIFIER),
    state: sessionStorage.getItem(DERIV_OAUTH_STORAGE.STATE),
  };
}

export function clearDerivPkceSession(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(DERIV_OAUTH_STORAGE.CODE_VERIFIER);
  sessionStorage.removeItem(DERIV_OAUTH_STORAGE.STATE);
}

/**
 * Step 2 — build authorize URL (`response_type=code`, PKCE S256, optional legacy `app_id`,
 * optional `prompt=registration` and partner UTM params per Deriv docs).
 */
export function buildDerivOAuthAuthorizeUrl(opts: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
  /** Default `trade account_manage` (URL-encoded as `trade+account_manage`). */
  scope?: string;
  /** Legacy API bridge — only if you maintain a Legacy Deriv API app. */
  legacyAppId?: string;
  /** Sign-up: add `prompt=registration`. */
  promptRegistration?: boolean;
  partner?: DerivOAuthPartnerParams;
}): string {
  const params = new URLSearchParams();
  params.set('response_type', 'code');
  params.set('client_id', opts.clientId.trim());
  params.set('redirect_uri', opts.redirectUri.trim());
  params.set('scope', opts.scope ?? 'trade account_manage');
  params.set('state', opts.state);
  params.set('code_challenge', opts.codeChallenge);
  params.set('code_challenge_method', 'S256');
  const legacy = opts.legacyAppId?.trim();
  if (legacy) params.set('app_id', legacy);
  if (opts.promptRegistration) params.set('prompt', 'registration');
  const p = opts.partner;
  if (p?.sidc?.trim()) params.set('sidc', p.sidc.trim());
  if (p?.utm_campaign?.trim()) params.set('utm_campaign', p.utm_campaign.trim());
  if (p?.utm_medium?.trim()) params.set('utm_medium', p.utm_medium.trim());
  if (p?.utm_source?.trim()) params.set('utm_source', p.utm_source.trim());
  return `${DERIV_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Full login kick-off: generate PKCE, store session, return authorize URL (caller redirects).
 */
export async function createDerivOAuthAuthorizeUrl(opts: {
  clientId: string;
  /** Defaults to `NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI` when omitted. */
  redirectUri?: string;
  scope?: string;
  legacyAppId?: string;
  promptRegistration?: boolean;
  partner?: DerivOAuthPartnerParams;
}): Promise<string> {
  const redirectUri = resolveDerivOAuthRedirectUri(opts.redirectUri);
  const { codeVerifier, codeChallenge, state } = await generateDerivPkcePair();
  storeDerivPkceSession(codeVerifier, state);
  return buildDerivOAuthAuthorizeUrl({
    clientId: opts.clientId,
    redirectUri,
    codeChallenge,
    state,
    scope: opts.scope,
    legacyAppId: opts.legacyAppId,
    promptRegistration: opts.promptRegistration,
    partner: opts.partner,
  });
}

/** Step 3 — validate `state` from callback query vs sessionStorage. */
export function validateDerivOAuthCallbackState(callbackState: string | null): boolean {
  if (!callbackState) return false;
  const { state } = readDerivPkceSession();
  return Boolean(state && state === callbackState);
}

export type DerivTokenExchangeResult = {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
};

/**
 * Step 4 — exchange `code` via this app’s server route (never call Deriv’s token URL from the browser).
 * Clears PKCE session storage on success.
 */
export async function exchangeDerivOAuthCode(opts: {
  code: string;
  /** Defaults to `NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI` when omitted. */
  redirectUri?: string;
  /** Default `/api/auth/deriv/token` */
  tokenEndpoint?: string;
}): Promise<DerivTokenExchangeResult> {
  const { codeVerifier } = readDerivPkceSession();
  if (!codeVerifier) {
    throw new Error('Missing PKCE code_verifier in sessionStorage');
  }
  const redirectUri = resolveDerivOAuthRedirectUri(opts.redirectUri);
  const endpoint = opts.tokenEndpoint ?? '/api/auth/deriv/token';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: opts.code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof data.error === 'string'
        ? data.error
        : typeof data.description === 'string'
          ? data.description
          : `Token exchange failed (${res.status})`;
    throw new Error(msg);
  }
  const access_token = data.access_token;
  if (typeof access_token !== 'string' || !access_token) {
    throw new Error('Invalid token response');
  }
  clearDerivPkceSession();
  return {
    access_token,
    expires_in: typeof data.expires_in === 'number' ? data.expires_in : 3600,
    token_type: typeof data.token_type === 'string' ? data.token_type : 'Bearer',
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
  };
}
