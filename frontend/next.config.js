/** @type {import('next').NextConfig} */
// Keep browser authorize URL + server token exchange on the same redirect (Deriv requires exact match).
const derivOAuthRedirect =
  (process.env.NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI || '').trim() ||
  (process.env.DERIV_OAUTH_REDIRECT_URI || '').trim();

const nextConfig = {
  reactStrictMode: true,
  env: derivOAuthRedirect
    ? { NEXT_PUBLIC_DERIV_OAUTH_REDIRECT_URI: derivOAuthRedirect }
    : {},
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'https', hostname: 'unavatar.io' },
      { protocol: 'https', hostname: 'pbs.twimg.com' },
      { protocol: 'https', hostname: 'abs.twimg.com' },
      { protocol: 'https', hostname: 'api.twitter.com' },
      { protocol: 'https', hostname: 'x.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
    ],
  },
};

export default nextConfig;
