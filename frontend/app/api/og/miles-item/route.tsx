import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const API_BASE = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

const ID_RE = /^[a-zA-Z0-9_\-]{1,64}$/;

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
  if (!ID_RE.test(id)) {
    return new Response('invalid id', { status: 400 });
  }

  let name = 'Catalog Item';
  let cost = 0;
  let description = '';
  let category = '';

  try {
    const res = await fetch(`${API_BASE}/api/miles/catalog/${id}`, { next: { revalidate: 300 } });
    if (res.ok) {
      const data = await res.json();
      const c = data.item || data.data || data;
      name = sanitizeName(c.name);
      cost = Number(c.miles_cost ?? c.milesCost ?? 0);
      description = typeof c.description === 'string' ? c.description.slice(0, 120) : '';
      category = typeof c.category === 'string' ? c.category.replace(/_/g, ' ') : '';
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
            DERIVARENA · MILES
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '3px' }}>
            {category}
          </div>
        </div>

        <div style={{ fontSize: '32px', color: '#E8B45E', fontWeight: 700, letterSpacing: '2px', marginBottom: '12px' }}>
          NEW DROP
        </div>

        <div style={{ fontSize: '56px', fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: '16px', lineHeight: 1.1 }}>
          {name}
        </div>

        {description && (
          <div style={{ fontSize: '22px', color: 'rgba(255,255,255,0.6)', marginBottom: '40px', lineHeight: 1.4 }}>
            {description}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
          <div style={{ fontSize: '72px', fontWeight: 700, color: '#E8B45E' }}>
            {cost.toLocaleString()}
          </div>
          <div style={{ fontSize: '28px', color: 'rgba(255,255,255,0.5)' }}>
            miles
          </div>
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
