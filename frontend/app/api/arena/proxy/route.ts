import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';
const TIMEOUT_MS = 5000;

/**
 * Proxies arena tab requests to the Go backend.
 * Falls back to empty data if the backend is unreachable.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get('path');
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  const allowedPrefixes = ['/api/'];
  const isAllowed = allowedPrefixes.some(p => path.startsWith(p));
  if (!isAllowed) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${BACKEND_URL}${path}`, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Arena-User-Id': session.uid,
      },
    });

    clearTimeout(timeout);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Backend unavailable', fallback: true, data: [] },
      { status: 200 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get('path');
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  const allowedPrefixes = ['/api/'];
  if (!allowedPrefixes.some(p => path.startsWith(p))) {
    return NextResponse.json({ error: 'Path not allowed' }, { status: 403 });
  }

  try {
    const body = await req.text();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Arena-User-Id': session.uid,
      },
      body,
    });

    clearTimeout(timeout);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Backend unavailable', fallback: true },
      { status: 200 },
    );
  }
}
