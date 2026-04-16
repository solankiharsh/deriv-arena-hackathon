import { describe, expect, it } from 'vitest';
import {
  buildDerivOAuthAuthorizeUrl,
  generateDerivPkcePair,
} from '@/lib/deriv/oauthPkce';

describe('oauthPkce (Deriv docs)', () => {
  it('generates 64-char verifier and base64url-style challenge', async () => {
    const { codeVerifier, codeChallenge, state } = await generateDerivPkcePair();
    expect(codeVerifier).toHaveLength(64);
    expect(state).toHaveLength(32);
    expect(codeChallenge).not.toContain('+');
    expect(codeChallenge).not.toContain('/');
    expect(codeChallenge.endsWith('=')).toBe(false);
    expect(codeChallenge.length).toBeGreaterThan(40);
  });

  it('builds auth.deriv.com authorize URL with required params', async () => {
    const { codeChallenge, state } = await generateDerivPkcePair();
    const url = buildDerivOAuthAuthorizeUrl({
      clientId: 'appUnitTest',
      redirectUri: 'https://example.com/callback',
      codeChallenge,
      state,
    });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://auth.deriv.com/oauth2/auth');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(u.searchParams.get('client_id')).toBe('appUnitTest');
    expect(u.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
    expect(u.searchParams.get('scope')).toBe('trade account_manage');
    expect(u.searchParams.get('state')).toBe(state);
    expect(u.searchParams.get('code_challenge')).toBe(codeChallenge);
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('adds optional legacy app_id and signup prompt', async () => {
    const { codeChallenge, state } = await generateDerivPkcePair();
    const url = buildDerivOAuthAuthorizeUrl({
      clientId: 'c',
      redirectUri: 'https://example.com/cb',
      codeChallenge,
      state,
      legacyAppId: '999',
      promptRegistration: true,
      partner: {
        utm_medium: 'affiliate',
        utm_source: 'CU1',
        utm_campaign: 'c1',
        sidc: '0FB46285-28A0-425E-B2E4-74F07D51EBB8',
      },
    });
    const u = new URL(url);
    expect(u.searchParams.get('app_id')).toBe('999');
    expect(u.searchParams.get('prompt')).toBe('registration');
    expect(u.searchParams.get('utm_medium')).toBe('affiliate');
    expect(u.searchParams.get('utm_source')).toBe('CU1');
    expect(u.searchParams.get('utm_campaign')).toBe('c1');
    expect(u.searchParams.get('sidc')).toBe('0FB46285-28A0-425E-B2E4-74F07D51EBB8');
  });
});
