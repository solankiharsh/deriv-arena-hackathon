'use strict';

import { pool } from '@/lib/db/postgres';

export type CopilotEntitlementStatus =
  | { ok: true; creditsRemaining: number; expiresAt: string }
  | { ok: false; reason: 'no_db' | 'no_row' | 'expired' | 'no_credits' };

export async function getTradingCopilotEntitlement(userId: string): Promise<CopilotEntitlementStatus> {
  if (!process.env.DATABASE_URL) {
    return { ok: false, reason: 'no_db' };
  }
  const client = await pool.connect();
  try {
    const res = await client.query<{ credits_remaining: number; expires_at: Date }>(
      `SELECT credits_remaining, expires_at
       FROM deriv_trading_copilot_entitlements
       WHERE user_id = $1`,
      [userId],
    );
    if (res.rowCount === 0) {
      return { ok: false, reason: 'no_row' };
    }
    const row = res.rows[0];
    if (row.expires_at.getTime() <= Date.now()) {
      return { ok: false, reason: 'expired' };
    }
    if (row.credits_remaining <= 0) {
      return { ok: false, reason: 'no_credits' };
    }
    return {
      ok: true,
      creditsRemaining: row.credits_remaining,
      expiresAt: row.expires_at.toISOString(),
    };
  } finally {
    client.release();
  }
}

/** Atomically consume one message credit. Returns false if none available. */
export async function consumeTradingCopilotCredit(userId: string): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE deriv_trading_copilot_entitlements
       SET credits_remaining = credits_remaining - 1,
           updated_at = NOW()
       WHERE user_id = $1
         AND credits_remaining > 0
         AND expires_at > NOW()
       RETURNING user_id`,
      [userId],
    );
    return (res.rowCount ?? 0) > 0;
  } finally {
    client.release();
  }
}
