'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { parseTrackingCustom1 } from '@/lib/partner-tracking';

/**
 * `/click` is the internal landing page for DerivArena invite links.
 *
 * Partner-tracking-style URLs that carry a `custom1` payload (the same
 * `a`, `o`, `c`, `link_id`, `custom1` params that Deriv's external tracker
 * uses) resolve here so the click stays inside our own domain instead of
 * bouncing through `partner-tracking.deriv.com`.
 *
 * The globally-mounted `ReferralCapture` in `app/layout.tsx` is the primary
 * mechanism that parses `custom1` and forwards to `destination_path`. This
 * page exists to:
 *   1. Give the `/click` path a real Next.js route so it resolves 200 OK,
 *      not 404, while `ReferralCapture` does its work.
 *   2. Handle the fallback case where the URL has no valid `custom1` (a
 *      bookmark, a truncated paste, or a bot) by gently redirecting home.
 *   3. Show a minimal loader so the user never sees a blank flash.
 *
 * No credentials, no network calls, no dangerous sinks: this page only
 * reads query params and calls `router.replace()`.
 */

function ClickLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-3 text-text-muted">
        <Loader2 className="w-6 h-6 animate-spin text-accent-primary" />
        <p className="text-xs font-mono uppercase tracking-[0.2em]">
          Routing you into DerivArena
        </p>
      </div>
    </div>
  );
}

function ClickRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const custom1 = parseTrackingCustom1(searchParams?.get('custom1'));
    if (custom1) {
      // ReferralCapture in the root layout performs the redirect on the
      // next render; we just wait.
      return;
    }
    const fallbackTimer = window.setTimeout(() => {
      router.replace('/arena');
    }, 400);
    return () => window.clearTimeout(fallbackTimer);
  }, [router, searchParams]);

  return <ClickLoader />;
}

export default function ClickRedirectPage() {
  return (
    <Suspense fallback={<ClickLoader />}>
      <ClickRedirectInner />
    </Suspense>
  );
}
