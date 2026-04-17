import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db/postgres';
import { getSession } from '@/lib/auth/session';
import type { GameInstance, InstancePlayer } from '@/lib/arena-types';
import {
  awardFirstFinish,
  awardGameXP,
  awardProfitableTrade,
  awardWinStreak,
  type AwardResult,
} from '@/lib/miles/xp';

interface StreakUpdateRow {
  current_win_streak: number;
  best_win_streak: number;
}

interface AwardSummary {
  user_id: string;
  trade?: AwardResult;
  xp?: AwardResult;
  streak?: AwardResult;
  streak_value?: number;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const instance = await queryOne<GameInstance>(
    'SELECT * FROM game_instances WHERE id = $1',
    [id],
  );

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  if (instance.started_by !== session.uid && session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (instance.status === 'finished') {
    return NextResponse.json({
      success: true,
      already_finalized: true,
      final_rankings: 0,
      awards: [],
    });
  }

  await execute(
    `UPDATE game_instances SET status = 'finished', finished_at = now() WHERE id = $1`,
    [id],
  );

  const players = await query<InstancePlayer>(
    'SELECT * FROM instance_players WHERE instance_id = $1 ORDER BY score DESC',
    [id],
  );

  const awardsByUser: AwardSummary[] = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const percentile = players.length > 1
      ? ((players.length - (i + 1)) / (players.length - 1)) * 100
      : 100;
    const normalized = Math.min(100, Math.max(0, percentile));

    await execute(
      'UPDATE instance_players SET rank = $1, normalized_score = $2 WHERE id = $3',
      [i + 1, normalized, player.id],
    );

    const ratingDelta = (normalized - 50) * 0.2;
    const isWinner = i === 0;

    await execute(
      `UPDATE arena_users
       SET arena_rating = GREATEST(0, arena_rating + $1),
           total_games = total_games + 1,
           total_wins = total_wins + $2,
           updated_at = now()
       WHERE id = $3`,
      [ratingDelta, isWinner ? 1 : 0, player.user_id],
    );

    const summary: AwardSummary = { user_id: player.user_id };

    // Starter Miles: crediting "finished first match" is idempotent per user
    // so replays on previously-finalized instances still grant it exactly
    // once. Wrapped in try/catch to never break rankings.
    try {
      await awardFirstFinish(player.user_id, id);
    } catch (err) {
      console.warn(
        `[finalize] awardFirstFinish failed instance=${id} user=${player.user_id}:`,
        err,
      );
    }

    const pnlNum = Number(player.pnl);
    if (Number.isFinite(pnlNum) && pnlNum > 0) {
      try {
        summary.trade = await awardProfitableTrade(player.user_id, id, pnlNum);
      } catch (err) {
        console.error(
          `[finalize] awardProfitableTrade failed instance=${id} user=${player.user_id}:`,
          err,
        );
      }
    }

    if (Number.isFinite(ratingDelta) && ratingDelta > 0) {
      try {
        summary.xp = await awardGameXP(player.user_id, id, ratingDelta);
      } catch (err) {
        console.error(
          `[finalize] awardGameXP failed instance=${id} user=${player.user_id}:`,
          err,
        );
      }
    }

    if (isWinner) {
      try {
        const updated = await queryOne<StreakUpdateRow>(
          `UPDATE arena_users
             SET current_win_streak = current_win_streak + 1,
                 best_win_streak    = GREATEST(best_win_streak, current_win_streak + 1),
                 updated_at         = now()
           WHERE id = $1
           RETURNING current_win_streak, best_win_streak`,
          [player.user_id],
        );
        const newStreak = updated?.current_win_streak ?? 0;
        summary.streak_value = newStreak;
        if (newStreak === 5 || newStreak === 10) {
          try {
            summary.streak = await awardWinStreak(player.user_id, newStreak);
          } catch (err) {
            console.error(
              `[finalize] awardWinStreak failed instance=${id} user=${player.user_id} streak=${newStreak}:`,
              err,
            );
          }
        }
      } catch (err) {
        console.error(
          `[finalize] streak increment failed instance=${id} user=${player.user_id}:`,
          err,
        );
      }
    } else {
      try {
        await execute(
          `UPDATE arena_users SET current_win_streak = 0, updated_at = now() WHERE id = $1`,
          [player.user_id],
        );
        summary.streak_value = 0;
      } catch (err) {
        console.error(
          `[finalize] streak reset failed instance=${id} user=${player.user_id}:`,
          err,
        );
      }
    }

    awardsByUser.push(summary);
  }

  return NextResponse.json({
    success: true,
    final_rankings: players.length,
    awards: awardsByUser,
  });
}
