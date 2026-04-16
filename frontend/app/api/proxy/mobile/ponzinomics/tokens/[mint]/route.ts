import { NextResponse } from 'next/server';

/** Local stub for war-room token metrics. */
export async function GET() {
  return NextResponse.json({ success: false, data: {} });
}
