'use strict';

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession } from '@/lib/auth/session';
import { pool } from '@/lib/db/postgres';

const DEFAULT_GRANT = 100_000;

/**
 * Local / preview only: credits the current session user for marketplace testing.
 * Disabled in production. Optionally set DEV_TEST_MILES_AMOUNT (integer).
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 });
  }

  const raw = process.env.DEV_TEST_MILES_AMOUNT;
  const amount = raw && /^\d+$/.test(raw.trim()) ? Math.min(parseInt(raw, 10), 1_000_000) : DEFAULT_GRANT;
  if (amount <= 0) {
    return NextResponse.json({ error: 'Invalid DEV_TEST_MILES_AMOUNT' }, { status: 400 });
  }

  const userId = session.uid;
  const txnId = randomUUID();
  const sourceId = `dev_grant_${randomUUID()}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO deriv_miles_transactions
         (id, user_id, transaction_type, amount, source_type, source_id, description, metadata)
       VALUES ($1, $2, 'earn', $3, 'manual', $4, $5, $6::jsonb)`,
      [
        txnId,
        userId,
        amount,
        sourceId,
        'Development test miles grant',
        JSON.stringify({ reason: 'dev_grant_test_miles' }),
      ],
    );

    await client.query(
      `INSERT INTO deriv_miles_balances (user_id, total_earned, current_balance, total_spent, tier)
       VALUES ($1, $2, $2, 0, 'bronze')
       ON CONFLICT (user_id) DO UPDATE SET
         total_earned    = deriv_miles_balances.total_earned + EXCLUDED.total_earned,
         current_balance = deriv_miles_balances.current_balance + EXCLUDED.current_balance,
         updated_at      = now()`,
      [userId, amount],
    );

    await client.query('COMMIT');

    const bal = await client.query<{ current_balance: string }>(
      `SELECT current_balance::text AS current_balance FROM deriv_miles_balances WHERE user_id = $1`,
      [userId],
    );

    return NextResponse.json({
      ok: true,
      granted: amount,
      userId,
      currentBalance: bal.rows[0]?.current_balance ?? null,
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    console.error('[dev/grant-test-miles]', err);
    return NextResponse.json({ error: 'Grant failed' }, { status: 500 });
  } finally {
    client.release();
  }
}
