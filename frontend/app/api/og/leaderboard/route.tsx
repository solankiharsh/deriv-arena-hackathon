import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RANGE_ALLOWED = new Set(['today', 'week', 'month']);

type Row = { name: string; sortino: number };

function sanitizeName(s: unknown): string {
  if (typeof s !== 'string') return '(hidden)';
  const t = s.trim();
  if (!t) return '(hidden)';
  if (!/^[\p{L}\p{N}_\-. ]{1,64}$/u.test(t)) return '(hidden)';
  return t;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawId = searchParams.get('competitionId') || '';
  const rawRange = searchParams.get('range') || '';
  const competitionId = UUID_RE.test(rawId) ? rawId : '';
  const range = RANGE_ALLOWED.has(rawRange) ? rawRange : '';

  let title = 'Daily Leaderboard';
  let rows: Row[] = [];

  try {
    if (competitionId) {
      const res = await fetch(`${API_BASE}/api/competitions/${competitionId}/leaderboard`, {
        next: { revalidate: 60 },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.leaderboard || data.rows || []);
        rows = list.slice(0, 5).map((r: any) => ({
          name: sanitizeName(r.trader_name || r.traderName || r.display_name || r.name || r.trader_id),
          sortino: Number(r.sortino_ratio ?? r.sortinoRatio ?? 0),
        }));
      }
    } else if (range === 'week') {
      title = 'Weekly Recap';
    }
  } catch {
    // Fall through to defaults; card still renders.
  }

  const medals = ['1', '2', '3', '4', '5'];

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px 80px',
          background: '#07090F',
          fontFamily: 'monospace',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '24px', color: '#E8B45E', fontWeight: 700, letterSpacing: '4px' }}>
            DERIVARENA
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)' }}>
            t.me/DerivArenaAsk
          </div>
        </div>

        <div style={{ fontSize: '56px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: '36px' }}>
          {title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {rows.length === 0 ? (
            <div style={{ fontSize: '28px', color: 'rgba(255,255,255,0.5)' }}>
              No active leaderboard — come make some noise.
            </div>
          ) : rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{
                width: '56px', height: '56px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: i === 0 ? '#E8B45E' : 'rgba(255,255,255,0.08)',
                color: i === 0 ? '#07090F' : 'rgba(255,255,255,0.9)',
                fontSize: '28px', fontWeight: 700, borderRadius: '12px',
              }}>
                {medals[i]}
              </div>
              <div style={{ flex: 1, fontSize: '32px', color: 'rgba(255,255,255,0.92)' }}>
                {r.name}
              </div>
              <div style={{ fontSize: '28px', color: '#E8B45E', fontWeight: 700 }}>
                {r.sortino.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px',
          background: 'linear-gradient(90deg, #E8B45E 0%, transparent 100%)',
        }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
    }
  );
}
