-- One-off: set every user's Deriv Miles balance to 2500 (local or production).
-- Constraint: current_balance = total_earned - total_spent
--
-- Run against your Postgres (example):
--   psql "$DATABASE_URL" -f backend/scripts/sql/set_all_miles_to_2500.sql
-- Do not commit connection strings or secrets.

BEGIN;

UPDATE deriv_miles_balances
SET
  total_earned = 2500,
  total_spent = 0,
  current_balance = 2500,
  updated_at = NOW();

-- Users who have trading bots but no balance row yet (dev / partial data)
INSERT INTO deriv_miles_balances (user_id, total_earned, current_balance, total_spent, tier)
SELECT DISTINCT user_id, 2500, 2500, 0, 'bronze'
FROM trading_bots
ON CONFLICT (user_id) DO UPDATE SET
  total_earned = 2500,
  total_spent = 0,
  current_balance = 2500,
  updated_at = NOW();

COMMIT;
