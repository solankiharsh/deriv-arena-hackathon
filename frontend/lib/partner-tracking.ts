'use client';

export type PartnerTrackingSource = 'copy' | 'whatsapp' | 'telegram' | 'twitter' | 'direct';

const TRACKING_BASE_URL =
  process.env.NEXT_PUBLIC_PARTNER_TRACKING_URL || 'https://partner-tracking.deriv.com/click';
const DEFAULT_BRAND_ID = '1';
const DEFAULT_COMMISSION_PLAN_ID =
  process.env.NEXT_PUBLIC_PARTNER_TRACKING_COMMISSION_PLAN_ID || '3';
const DEFAULT_LINK_ID =
  process.env.NEXT_PUBLIC_PARTNER_TRACKING_LINK_ID || '1';

export interface TrackingCustom1Payload {
  v: '1';
  partner_id: string;
  destination_path: string;
  source: PartnerTrackingSource;
}

export interface BuildPartnerTrackingUrlInput {
  affiliateId: string;
  partnerId: string;
  destinationPath: string;
  source: PartnerTrackingSource;
  commissionPlanId?: string;
  linkId?: string;
  /**
   * When true (default for invites that stay inside the app), the URL is
   * built against the current app origin (e.g. `https://arena.example.com/click?...`)
   * so clicking it routes back into DerivArena instead of leaving for the
   * external `partner-tracking.deriv.com` domain.
   *
   * The partner-tracking-style query params (`a`, `o`, `c`, `link_id`,
   * `custom1`) are preserved unchanged so the URL keeps the same "look and
   * feel" for affiliates. `ReferralCapture` in the root layout parses
   * `custom1` on any page (including `/click`) and performs an internal
   * redirect to `destination_path`.
   *
   * Leave this `false` when the destination is genuinely external (e.g.
   * `https://deriv.com/signup`) so the click can flow through the real
   * external tracker.
   */
  internal?: boolean;
}

export function buildTrackingCustom1(payload: TrackingCustom1Payload): string {
  const params = new URLSearchParams();
  params.set('v', payload.v);
  params.set('partner_id', payload.partner_id);
  params.set('destination_path', payload.destination_path);
  params.set('source', payload.source);
  return params.toString();
}

export function parseTrackingCustom1(raw: string | null | undefined): TrackingCustom1Payload | null {
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const partnerId = params.get('partner_id');
  const destinationPath = params.get('destination_path');
  const source = params.get('source') as PartnerTrackingSource | null;
  const version = params.get('v');

  if (!partnerId || !destinationPath || !source || version !== '1') {
    return null;
  }

  return {
    v: '1',
    partner_id: partnerId,
    destination_path: destinationPath,
    source,
  };
}

function getInternalTrackingBase(): string {
  // Prefer the live browser origin so localhost, staging, and prod all work
  // without configuration. Fall back to a conservative default that still
  // routes into the app during SSR or when window is not available.
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://arena.deriv.com';
  return `${origin}/click`;
}

export function buildPartnerTrackingUrl({
  affiliateId,
  partnerId,
  destinationPath,
  source,
  commissionPlanId = DEFAULT_COMMISSION_PLAN_ID,
  linkId = DEFAULT_LINK_ID,
  internal = false,
}: BuildPartnerTrackingUrlInput): string {
  const params = new URLSearchParams();
  params.set('a', affiliateId);
  params.set('o', DEFAULT_BRAND_ID);
  params.set('c', commissionPlanId);
  params.set('link_id', linkId);
  params.set(
    'custom1',
    buildTrackingCustom1({
      v: '1',
      partner_id: partnerId,
      destination_path: destinationPath,
      source,
    }),
  );

  const base = internal ? getInternalTrackingBase() : TRACKING_BASE_URL;
  return `${base}?${params.toString()}`;
}

export function buildDestinationPath(pathname: string, params?: Record<string, string | undefined>): string {
  const base =
    typeof window !== 'undefined' ? window.location.origin : 'https://arena.deriv.com';
  const target = new URL(pathname, base);

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      target.searchParams.set(key, value);
    }
  }

  if (/^https?:\/\//i.test(pathname)) {
    return target.toString();
  }

  return `${target.pathname}${target.search}`;
}
