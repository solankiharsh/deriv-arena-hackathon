import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ token: null, demoAccountId: null }, { status: 401 });
  }

  return NextResponse.json({
    token: session.dt || null,
    demoAccountId: session.da || null,
  });
}
