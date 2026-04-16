import { NextRequest, NextResponse } from 'next/server';

const RISK_LEVELS = new Set(['LOW', 'MEDIUM', 'HIGH', 'EXTREME']);
const CONTRACT_KEYS = new Set(['ACCU', 'MULTUP', 'MULTDOWN', 'CALL', 'PUT']);
const FEED_KEYS = new Set(['deriv_ticks', 'sentiment', 'pattern', 'partner']);

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(x)));
}

function sanitizeMarket(s: unknown): string {
  const t = typeof s === 'string' ? s.replace(/[^\w]/g, '').slice(0, 32) : '';
  return t || '1HZ100V';
}

function sanitizeContracts(raw: unknown): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const k of CONTRACT_KEYS) {
    if (k in o && typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeFeeds(raw: unknown): Record<string, boolean> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, boolean> = {};
  for (const k of FEED_KEYS) {
    if (k in o && typeof o[k] === 'boolean') out[k] = o[k] as boolean;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Persists Command Center trading knobs for the signed-in agent.
 * The Go competition API does not expose this route yet; the Next app
 * accepts PATCH here so Deploy Agent works in local dev without a second backend.
 */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ success: false, error: 'Body must be a JSON object' }, { status: 400 });
  }

  const o = body as Record<string, unknown>;

  const riskRaw = o.riskLevel;
  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' = 'MEDIUM';
  if (riskRaw != null) {
    if (typeof riskRaw !== 'string' || !RISK_LEVELS.has(riskRaw)) {
      return NextResponse.json({ success: false, error: 'Invalid riskLevel' }, { status: 400 });
    }
    riskLevel = riskRaw as 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  }

  const sanitized = {
    stakeAmount: clampInt(o.stakeAmount, 1, 50_000, 10),
    targetPayout: clampInt(o.targetPayout, 1, 1_000_000, 100),
    riskLevel,
    selectedMarket: sanitizeMarket(o.selectedMarket),
    enabledContracts: sanitizeContracts(o.enabledContracts),
    enabledFeeds: sanitizeFeeds(o.enabledFeeds),
  };

  return NextResponse.json({ success: true, data: sanitized });
}
