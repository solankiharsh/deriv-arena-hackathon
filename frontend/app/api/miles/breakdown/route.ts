import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';

interface SourceRow {
  source_type: string;
  event_count: string;
  miles: string;
  xp: string;
}

interface BalanceRow {
  total_earned: string;
  current_balance: string;
  tier: string;
}

interface StreakRow {
  current_win_streak: number;
  best_win_streak: number;
}

interface DailyLoginRow {
  id: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.uid;

  const sourceRows = await query<SourceRow>(
    `SELECT
       source_type,
       COUNT(*)::text                                                   AS event_count,
       COALESCE(SUM(amount), 0)::text                                   AS miles,
       COALESCE(SUM(COALESCE((metadata->>'xp')::numeric, amount * 10)), 0)::text AS xp
     FROM deriv_miles_transactions
     WHERE user_id = $1 AND transaction_type = 'earn'
     GROUP BY source_type
     ORDER BY SUM(amount) DESC`,
    [userId],
  );

  const balance = await queryOne<BalanceRow>(
    `SELECT total_earned::text, current_balance::text, tier
     FROM deriv_miles_balances WHERE user_id = $1`,
    [userId],
  );

  const streak = await queryOne<StreakRow>(
    `SELECT current_win_streak, best_win_streak FROM arena_users WHERE id = $1`,
    [userId],
  );

  const today = (() => {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  const dailyLoginSourceId = `daily_login_${userId}_${today}`;
  const dailyLoginRow = await queryOne<DailyLoginRow>(
    `SELECT id FROM deriv_miles_transactions
     WHERE user_id = $1 AND transaction_type = 'earn'
       AND source_type = 'daily_login' AND source_id = $2
     LIMIT 1`,
    [userId, dailyLoginSourceId],
  );

  const by_source = sourceRows.map((r) => ({
    source_type: r.source_type,
    event_count: Number(r.event_count),
    miles: Number(r.miles),
    xp: Number(r.xp),
  }));

  const total_xp = by_source.reduce((acc, r) => acc + r.xp, 0);
  const total_miles = balance ? Number(balance.current_balance) : 0;

  return NextResponse.json({
    total_xp,
    total_miles,
    total_earned_miles: balance ? Number(balance.total_earned) : 0,
    tier: balance?.tier ?? 'bronze',
    by_source,
    current_streak: streak?.current_win_streak ?? 0,
    best_streak: streak?.best_win_streak ?? 0,
    daily_login_today: !!dailyLoginRow,
  });
}
