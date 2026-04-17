import type { NextRequest } from 'next/server';

/**
 * Browser-facing origin (scheme + host, no trailing slash) for OAuth and
 * post-login redirects.
 *
 * Prefer `x-forwarded-*` headers set by Vercel so a custom domain such as
 * `arena.solharsh.com` matches the Deriv `redirect_uri` and the final
 * redirect target, even when `NEXT_PUBLIC_BASE_URL` still points at a
 * `*.vercel.app` hostname.
 */
export function getPublicOrigin(req: NextRequest): string {
  const xfHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const xfProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if (xfHost && xfProto) {
    return `${xfProto}://${xfHost}`.replace(/\/$/, '');
  }
  if (xfHost) {
    const proto = req.nextUrl.protocol.replace(':', '') || 'https';
    return `${proto}://${xfHost}`.replace(/\/$/, '');
  }

  const fromUrl = req.nextUrl.origin.replace(/\/$/, '');
  if (fromUrl && fromUrl !== 'null') return fromUrl;

  const configured = process.env.NEXT_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}
