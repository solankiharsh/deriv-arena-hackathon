import { NextResponse } from 'next/server';

/** Local stub: no upstream integration in this repo. */
export async function GET() {
  return NextResponse.json({ success: true, data: [] as unknown[] });
}
