'use strict';

/**
 * Deriv OAuth (authorize redirect + callback with acct1/token1) is intentionally deferred for this MVP.
 * Cherry-pick patterns from `origin/add/game`:
 * - `frontend/app/api/auth/deriv/route.ts`
 * - `frontend/app/api/auth/callback/route.ts` (requires session store + user table)
 *
 * Related env when implemented: `NEXT_PUBLIC_DERIV_APP_ID` or `DERIV_APP_ID`, `NEXT_PUBLIC_BASE_URL`.
 * Market data (optional): `MARKETDATA_ENABLED`, `MARKETDATA_SYMBOLS`, `MARKETDATA_INTERVAL_SEC`.
 */
export const DERIV_OAUTH_DEFERRED = true as const;
