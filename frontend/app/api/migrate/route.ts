import { NextResponse } from 'next/server';
import { runMigrations } from '@/lib/db/migrate';

export async function POST() {
  const secret = process.env.MIGRATION_SECRET || 'dev-migrate';
  // In production, protect with a secret header
  try {
    const log = await runMigrations();
    return NextResponse.json({ success: true, log });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Migration failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
