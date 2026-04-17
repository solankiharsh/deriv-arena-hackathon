import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

type Row = { name: string; pnl: number; winRate: number };

function sanitizeName(s: unknown): string {
  if (typeof s !== 'string') return '(hidden)';
  const t = s.trim();
  if (!t) return '(hidden)';
  if (!/^[\p{L}\p{N}_\-. ]{1,64}$/u.test(t)) return '(hidden)';
  return t;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const highlightRaw = searchParams.get('highlight') || '';
  const highlight = /^[\p{L}\p{N}_\-. ]{1,64}$/u.test(highlightRaw) ? highlightRaw : '';

  let rows: Row[] = [];

  try {
    const res = await fetch(`${API_BASE}/api/bots/leaderboard?range=week&limit=5`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.bots || data.leaderboard || []);
      rows = list.slice(0, 5).map((r: any) => ({
        name: sanitizeName(r.name),
        pnl: Number(r.total_pnl ?? r.totalPnl ?? 0),
        winRate: Number(r.win_rate ?? r.winRate ?? 0),
      }));
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
            DERIVARENA · BOTS
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)' }}>
            7d performance
          </div>
        </div>

        <div style={{ fontSize: '56px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: '36px' }}>
          Community Bot Board
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {rows.length === 0 ? (
            <div style={{ fontSize: '28px', color: 'rgba(255,255,255,0.5)' }}>
              No bot activity this week.
            </div>
          ) : rows.map((r, i) => {
            const hit = highlight && r.name === highlight;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '20px',
                padding: '12px 16px',
                background: hit ? 'rgba(232,180,94,0.12)' : 'transparent',
                borderRadius: '10px',
              }}>
                <div style={{
                  width: '48px', height: '48px', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: i === 0 ? '#E8B45E' : 'rgba(255,255,255,0.08)',
                  color: i === 0 ? '#07090F' : 'rgba(255,255,255,0.9)',
                  fontSize: '24px', fontWeight: 700, borderRadius: '10px',
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: '28px', color: 'rgba(255,255,255,0.92)' }}>
                  {r.name}
                </div>
                <div style={{ fontSize: '24px', color: r.pnl >= 0 ? '#4ade80' : '#f87171', fontWeight: 700, width: '200px', textAlign: 'right' }}>
                  {r.pnl >= 0 ? '+' : ''}${r.pnl.toFixed(2)}
                </div>
                <div style={{ fontSize: '20px', color: 'rgba(255,255,255,0.5)', width: '100px', textAlign: 'right' }}>
                  {r.winRate.toFixed(1)}%
                </div>
              </div>
            );
          })}
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
