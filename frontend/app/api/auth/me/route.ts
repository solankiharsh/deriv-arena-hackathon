import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { queryOne } from '@/lib/db/postgres';
import type { ArenaUser } from '@/lib/arena-types';
import { awardDailyLogin } from '@/lib/miles/xp';

// Synthetic user map for demo sessions and no-DB environments.
// Matches the accounts seeded by /api/auth/demo and the migration SEED_SQL.
const SYNTHETIC_USERS: Record<string, Partial<ArenaUser>> = {
  DEMO_P1:      { deriv_account_id: 'DEMO_P1',      display_name: 'Demo Player',  role: 'player' },
  DEMO_PARTNER: { deriv_account_id: 'DEMO_PARTNER', display_name: 'Demo Partner', role: 'partner' },
  DEMO_ADMIN:   { deriv_account_id: 'DEMO_ADMIN',   display_name: 'Demo Admin',   role: 'admin' },
};

function syntheticUser(session: { uid: string; did: string; role: string; name: string }): ArenaUser {
  const base = SYNTHETIC_USERS[session.did] ?? {};
  return {
    id: session.uid,
    deriv_account_id: session.did,
    deriv_login_id: session.did,
    display_name: session.name,
    avatar_url: null,
    role: session.role as ArenaUser['role'],
    arena_rating: 0,
    total_games: 0,
    total_wins: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...base,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const hasDb = !!process.env.DATABASE_URL;

  if (!hasDb) {
    // No database — return a user reconstructed from the session JWT.
    // This keeps demo-login and OAuth sessions alive on Vercel without a DB.
    return NextResponse.json({ user: syntheticUser(session) });
  }

  try {
    const user = await queryOne<ArenaUser>(
      'SELECT * FROM arena_users WHERE id = $1',
      [session.uid],
    );

    if (!user) {
      // Session JWT is valid but user not in DB (e.g. DB was reset).
      // Return synthetic user so the session stays alive instead of logging out.
      console.warn(`[auth/me] User not in DB uid=${session.uid}, returning synthetic`);
      return NextResponse.json({ user: syntheticUser(session) });
    }

    // Idempotent daily-login miles award. Never fail /me because of miles.
    try {
      const result = await awardDailyLogin(session.uid);
      if (result.awarded) {
        console.log(
          `[auth/me] daily login awarded uid=${session.uid} xp=${result.xp} miles=${result.miles}`,
        );
      }
    } catch (milesErr) {
      console.error(`[auth/me] daily login award failed uid=${session.uid}:`, milesErr);
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error(`[auth/me] DB error uid=${session.uid}:`, err);
    // DB error — still return synthetic user to prevent sign-in loop.
    return NextResponse.json({ user: syntheticUser(session) });
  }
}
