'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { parseTrackingCustom1 } from '@/lib/partner-tracking';

export function ReferralCapture() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams?.get('ref');
    const source = searchParams?.get('utm_source');
    const custom1 = parseTrackingCustom1(searchParams?.get('custom1'));

    if (ref) {
      localStorage.setItem('derivarena_ref', ref);
    }

    if (!custom1) return;

    localStorage.setItem('derivarena_ref', custom1.partner_id);

    const target = new URL(custom1.destination_path, window.location.origin);
    if (!target.searchParams.has('ref')) {
      target.searchParams.set('ref', custom1.partner_id);
    }
    if (!target.searchParams.has('utm_source')) {
      target.searchParams.set('utm_source', custom1.source);
    }

    const current = new URL(window.location.href);
    const nextPath = `${target.pathname}${target.search}`;
    const currentPath = `${current.pathname}${current.search}`;

    if (nextPath !== currentPath && pathname !== '/api') {
      router.replace(nextPath);
      return;
    }

    if (!source && custom1.source) {
      router.replace(nextPath);
    }
  }, [pathname, router, searchParams]);

  return null;
}
