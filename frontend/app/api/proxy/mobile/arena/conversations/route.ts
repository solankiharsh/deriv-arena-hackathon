import { NextResponse } from 'next/server';

/** Local stub for war-room canvas. */
export async function GET() {
  return NextResponse.json({ conversations: [] });
}
