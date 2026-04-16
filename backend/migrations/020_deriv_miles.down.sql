-- Rollback Deriv Miles Rewards System

DROP TRIGGER IF EXISTS trigger_check_deriv_miles_balance ON deriv_miles_balances;
DROP TRIGGER IF EXISTS trigger_update_deriv_miles_tier ON deriv_miles_balances;
DROP FUNCTION IF EXISTS check_deriv_miles_balance();
DROP FUNCTION IF EXISTS update_deriv_miles_tier();

DROP TABLE IF EXISTS deriv_miles_redemptions;
DROP TABLE IF EXISTS deriv_miles_catalog;
DROP TABLE IF EXISTS deriv_miles_transactions;
DROP TABLE IF EXISTS deriv_miles_earning_rules;
DROP TABLE IF EXISTS deriv_miles_balances;
