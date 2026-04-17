import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeName(s: unknown): string {
  if (typeof s !== 'string') return '(hidden)';
  const t = s.trim();
  if (!t) return '(hidden)';
  if (!/^[\p{L}\p{N}_\-. ]{1,64}$/u.test(t)) return '(hidden)';
  return t;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  if (!UUID_RE.test(id)) {
    return new Response('invalid id', { status: 400 });
  }

  let name = 'Competition';
  let duration = 0;
  let balance = 0;

  try {
    const res = await fetch(`${API_BASE}/api/competitions/${id}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      const c = data.competition || data.data || data;
      name = sanitizeName(c.name);
      duration = Number(c.duration_hours ?? c.durationHours ?? 0);
      balance = Number(c.starting_balance ?? c.startingBalance ?? 0);
    }
  } catch {
    // Defaults.
  }

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
            New competition
          </div>
        </div>

        <div style={{ fontSize: '32px', color: '#E8B45E', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px' }}>
          LIVE NOW
        </div>

        <div style={{ fontSize: '64px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: '48px', lineHeight: 1.1 }}>
          {name}
        </div>

        <div style={{ display: 'flex', gap: '80px' }}>
          {duration > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '48px', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
                {duration}h
              </div>
              <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
                Duration
              </div>
            </div>
          )}
          {balance > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: '48px', fontWeight: 700, color: 'rgba(255,255,255,0.92)' }}>
                ${balance.toLocaleString()}
              </div>
              <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>
                Starting balance
              </div>
            </div>
          )}
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
