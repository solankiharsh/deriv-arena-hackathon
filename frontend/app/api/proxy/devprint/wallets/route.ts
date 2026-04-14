import { NextResponse } from 'next/server';

/** Local stub: war room expects `{ success, data: { wallets } }`. */
export async function GET() {
  return NextResponse.json({ success: true, data: { wallets: [] } });
}
