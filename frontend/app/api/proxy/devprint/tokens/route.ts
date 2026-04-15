import { NextResponse } from 'next/server';

/** Local stub: war room expects `{ success, data: StreamToken[] }`. */
export async function GET() {
  return NextResponse.json({ success: true, data: [] });
}
