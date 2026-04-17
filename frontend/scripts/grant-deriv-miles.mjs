#!/usr/bin/env node
/**
 * One-off: credit Deriv miles to an arena user by UUID (arena_users.id / session uid).
 *
 * Usage (from frontend/, with DATABASE_URL set):
 *   node scripts/grant-deriv-miles.mjs <user-uuid> [amount]
 *
 * Example:
 *   node --env-file=../.env scripts/grant-deriv-miles.mjs 939f5596-b035-434f-bd79-558fc5726d05 100000
 */
'use strict';

import pg from 'pg';
import { randomUUID } from 'crypto';

const userId = process.argv[2];
const rawAmount = process.argv[3];
const amount =
  rawAmount && /^\d+$/.test(String(rawAmount).trim())
    ? Math.min(parseInt(String(rawAmount).trim(), 10), 1_000_000)
    : 100_000;

if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
  console.error('Usage: node scripts/grant-deriv-miles.mjs <user-uuid> [amount]');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

// Managed Postgres providers (Railway, Neon, etc.) often present a self-signed
// chain over TLS. Set DATABASE_SSL_UNVERIFIED=1 to allow those connections.
const sslUnverified = process.env.DATABASE_SSL_UNVERIFIED === '1';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(sslUnverified ? { ssl: { rejectUnauthorized: false } } : {}),
});

const txnId = randomUUID();
const sourceId = `manual_grant_${randomUUID()}`;

try {
  const client = await pool.connect();
  try {
    const exists = await client.query('SELECT 1 FROM arena_users WHERE id = $1', [userId]);
    if (exists.rowCount === 0) {
      console.error(`No arena_users row for id=${userId}`);
      process.exit(2);
    }

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
        'Manual miles grant (script)',
        JSON.stringify({ reason: 'grant_deriv_miles_script' }),
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

    const bal = await client.query(
      `SELECT current_balance::text AS current_balance FROM deriv_miles_balances WHERE user_id = $1`,
      [userId],
    );
    console.log(
      JSON.stringify(
        { ok: true, userId, granted: amount, currentBalance: bal.rows[0]?.current_balance ?? null },
        null,
        2,
      ),
    );
  } catch (e) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
