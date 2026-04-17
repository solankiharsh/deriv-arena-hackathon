import { pool } from '@/lib/db/postgres';

export type MilesSourceType =
  | 'xp'
  | 'profitable_trade'
  | 'competition_win'
  | 'win_streak'
  | 'daily_login'
  | 'referral'
  | 'manual'
  // Starter "quick wins" — fire at most once per user so first-time players
  // can see Miles roll in from real actions (not just daily login) and afford
  // their first Marketplace redemption in a single session.
  | 'first_join'
  | 'first_game'
  | 'first_trade'
  | 'first_finish'
  | 'share_link'
  | 'referral_join';

export interface AwardXPInput {
  userId: string;
  sourceType: MilesSourceType;
  sourceId: string;
  xp: number;
  description: string;
  metadata?: Record<string, unknown>;
}

export type AwardResult =
  | { awarded: true; miles: number; xp: number }
  | { awarded: false; reason: 'below_threshold' | 'duplicate' | 'no_user' | 'no_db' };

const hasDb = !!process.env.DATABASE_URL;

function utcDateString(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export async function awardXP(input: AwardXPInput): Promise<AwardResult> {
  const { userId, sourceType, sourceId, description } = input;

  if (!userId) {
    return { awarded: false, reason: 'no_user' };
  }
  if (!hasDb) {
    console.warn('[miles] DATABASE_URL not configured — award skipped', {
      sourceType,
      sourceId,
    });
    return { awarded: false, reason: 'no_db' };
  }

  const xp = Number.isFinite(input.xp) ? Math.floor(input.xp) : 0;
  const miles = Math.floor(xp / 10);
  if (miles <= 0) {
    return { awarded: false, reason: 'below_threshold' };
  }

  const metadata = {
    ...(input.metadata ?? {}),
    xp,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const insertRes = await client.query(
      `INSERT INTO deriv_miles_transactions
         (user_id, transaction_type, amount, source_type, source_id, description, metadata)
       VALUES ($1, 'earn', $2, $3, $4, $5, $6::jsonb)
       ON CONFLICT (source_type, source_id)
         WHERE source_id IS NOT NULL AND transaction_type = 'earn'
       DO NOTHING
       RETURNING id`,
      [
        userId,
        miles,
        sourceType,
        sourceId,
        description,
        JSON.stringify(metadata),
      ],
    );

    if (insertRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return { awarded: false, reason: 'duplicate' };
    }

    await client.query(
      `INSERT INTO deriv_miles_balances
         (user_id, total_earned, current_balance, total_spent, tier)
       VALUES ($1, $2, $2, 0, 'bronze')
       ON CONFLICT (user_id) DO UPDATE SET
         total_earned    = deriv_miles_balances.total_earned + EXCLUDED.total_earned,
         current_balance = deriv_miles_balances.current_balance + EXCLUDED.current_balance,
         updated_at      = now()`,
      [userId, miles],
    );

    await client.query('COMMIT');
    return { awarded: true, miles, xp };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ROLLBACK can fail if the connection is already dead; swallow to surface the original error.
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function awardDailyLogin(userId: string): Promise<AwardResult> {
  const today = utcDateString();
  return awardXP({
    userId,
    sourceType: 'daily_login',
    sourceId: `daily_login_${userId}_${today}`,
    xp: 50,
    description: 'Daily login bonus',
    metadata: { date: today },
  });
}

export async function awardProfitableTrade(
  userId: string,
  instanceId: string,
  pnl: number,
): Promise<AwardResult> {
  if (!Number.isFinite(pnl) || pnl <= 0) {
    return { awarded: false, reason: 'below_threshold' };
  }
  const xp = Math.floor(clamp(Math.round(pnl * 5), 10, 500));
  return awardXP({
    userId,
    sourceType: 'profitable_trade',
    sourceId: `trade_instance_${instanceId}_${userId}`,
    xp,
    description: 'Profitable trade bonus',
    metadata: { instance_id: instanceId, pnl },
  });
}

export async function awardGameXP(
  userId: string,
  instanceId: string,
  ratingDelta: number,
): Promise<AwardResult> {
  if (!Number.isFinite(ratingDelta) || ratingDelta <= 0) {
    return { awarded: false, reason: 'below_threshold' };
  }
  const xp = Math.max(0, Math.round(ratingDelta * 10));
  if (xp <= 0) {
    return { awarded: false, reason: 'below_threshold' };
  }
  return awardXP({
    userId,
    sourceType: 'xp',
    sourceId: `xp_instance_${instanceId}_${userId}`,
    xp,
    description: 'Game XP reward',
    metadata: { instance_id: instanceId, rating_delta: ratingDelta },
  });
}

export async function awardWinStreak(
  userId: string,
  streakLen: number,
): Promise<AwardResult> {
  if (streakLen !== 5 && streakLen !== 10) {
    return { awarded: false, reason: 'below_threshold' };
  }
  const xp = streakLen === 10 ? 2500 : 1000;
  return awardXP({
    userId,
    sourceType: 'win_streak',
    sourceId: `streak_${userId}_${streakLen}`,
    xp,
    description: `${streakLen}-win streak milestone`,
    metadata: { streak_length: streakLen },
  });
}

/**
 * Starter reward helpers.
 *
 * Each `awardFirst*` grants miles at most once per user by keying the
 * idempotency `source_id` to a stable `${source}_${userId}` value. The
 * `source_type` enum guarantees the DB unique index on (source_type,
 * source_id) collapses repeated calls to a no-op.
 */
const STARTER_MILES = {
  firstJoin: 100,
  firstGame: 150,
  firstTrade: 125,
  firstFinish: 175,
  shareLink: 100,
  referralJoin: 250,
} as const;

export async function awardFirstJoin(userId: string): Promise<AwardResult> {
  return awardXP({
    userId,
    sourceType: 'first_join',
    sourceId: `first_join_${userId}`,
    xp: STARTER_MILES.firstJoin * 10,
    description: 'Joined your first competition',
  });
}

export async function awardFirstGame(userId: string): Promise<AwardResult> {
  return awardXP({
    userId,
    sourceType: 'first_game',
    sourceId: `first_game_${userId}`,
    xp: STARTER_MILES.firstGame * 10,
    description: 'Played your first arena game',
  });
}

export async function awardFirstTrade(
  userId: string,
  instanceId: string,
): Promise<AwardResult> {
  return awardXP({
    userId,
    sourceType: 'first_trade',
    sourceId: `first_trade_${userId}`,
    xp: STARTER_MILES.firstTrade * 10,
    description: 'Placed your first trade in a game',
    metadata: { instance_id: instanceId },
  });
}

export async function awardFirstFinish(
  userId: string,
  instanceId: string,
): Promise<AwardResult> {
  return awardXP({
    userId,
    sourceType: 'first_finish',
    sourceId: `first_finish_${userId}`,
    xp: STARTER_MILES.firstFinish * 10,
    description: 'Finished your first full match',
    metadata: { instance_id: instanceId },
  });
}

export async function awardShareLink(
  userId: string,
  templateSlug: string,
): Promise<AwardResult> {
  return awardXP({
    userId,
    sourceType: 'share_link',
    sourceId: `share_link_${userId}`,
    xp: STARTER_MILES.shareLink * 10,
    description: 'Shared your first competition link',
    metadata: { template_slug: templateSlug },
  });
}

export async function awardReferralJoin(
  referrerUserId: string,
  joinerUserId: string,
): Promise<AwardResult> {
  // Scoped to (referrer, joiner) so the same referrer can keep earning for
  // unique new joiners, but not repeatedly for the same one.
  return awardXP({
    userId: referrerUserId,
    sourceType: 'referral_join',
    sourceId: `referral_join_${referrerUserId}_${joinerUserId}`,
    xp: STARTER_MILES.referralJoin * 10,
    description: 'A new player joined through your share link',
    metadata: { joiner_user_id: joinerUserId },
  });
}

export async function awardCompetitionWin(
  userId: string,
  competitionId: string,
  rank: number,
): Promise<AwardResult> {
  if (rank !== 1 && rank !== 2 && rank !== 3) {
    return { awarded: false, reason: 'below_threshold' };
  }
  const xp = rank === 1 ? 5000 : 2000;
  return awardXP({
    userId,
    sourceType: 'competition_win',
    sourceId: `comp_win_${competitionId}_${userId}`,
    xp,
    description: `Competition rank ${rank}`,
    metadata: { competition_id: competitionId, rank },
  });
}
