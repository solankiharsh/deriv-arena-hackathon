'use client';

import { useParams, usePathname } from 'next/navigation';

/**
 * Resolves a dynamic `[id]` segment reliably across Next.js versions.
 * Falls back to parsing the pathname when `useParams()` is not ready yet.
 */
export function useRouteParamId(segment: 'competitions' | 'join' | 'compete'): string | undefined {
  const params = useParams<{ id?: string | string[] }>();
  const pathname = usePathname();

  const raw = params?.id;
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];

  if (!pathname) return undefined;

  const parts = pathname.split('/').filter(Boolean);
  if (segment === 'competitions' && parts[0] === 'competitions' && parts[1]) {
    return parts[1];
  }
  if (segment === 'join' && parts[0] === 'join' && parts[1]) {
    return parts[1];
  }
  if (segment === 'compete' && parts[0] === 'compete' && parts[1]) {
    return parts[1];
  }
  return undefined;
}
