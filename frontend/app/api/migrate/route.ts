import { NextResponse } from 'next/server';
import { runMigrations } from '@/lib/db/migrate';

export async function POST() {
  console.log('[migrate] Running schema migration...');
  try {
    const log = await runMigrations();
    console.log('[migrate] Success:', log);
    return NextResponse.json({ success: true, log });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Migration failed';
    console.error('[migrate] Failed:', message, err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
