import { pool } from './postgres';

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS arena_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deriv_account_id TEXT UNIQUE NOT NULL,
  deriv_login_id   TEXT NOT NULL DEFAULT '',
  display_name     TEXT NOT NULL,
  avatar_url       TEXT,
  role             TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','partner','admin')),
  arena_rating     NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_games      INT NOT NULL DEFAULT 0,
  total_wins       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  game_mode     TEXT NOT NULL CHECK (game_mode IN ('classic','phantom_league','boxing_ring','anti_you','war_room','behavioral_xray')),
  created_by    UUID NOT NULL REFERENCES arena_users(id),
  config        JSONB NOT NULL DEFAULT '{}',
  is_featured   BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  play_count    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_mode ON game_templates(game_mode);
CREATE INDEX IF NOT EXISTS idx_templates_creator ON game_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_slug ON game_templates(slug);

CREATE TABLE IF NOT EXISTS game_instances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id   UUID NOT NULL REFERENCES game_templates(id),
  template_slug TEXT NOT NULL,
  started_by    UUID NOT NULL REFERENCES arena_users(id),
  status        TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','live','finished','cancelled')),
  started_at    TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  player_count  INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instances_template ON game_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_instances_status ON game_instances(status);

CREATE TABLE IF NOT EXISTS instance_players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID NOT NULL REFERENCES game_instances(id),
  user_id         UUID NOT NULL REFERENCES arena_users(id),
  referred_by     UUID REFERENCES arena_users(id),
  score           NUMERIC(12,4) NOT NULL DEFAULT 0,
  normalized_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  rank            INT NOT NULL DEFAULT 0,
  trades_count    INT NOT NULL DEFAULT 0,
  pnl             NUMERIC(12,4) NOT NULL DEFAULT 0,
  behavioral_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active       BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(instance_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_iplayers_instance ON instance_players(instance_id);
CREATE INDEX IF NOT EXISTS idx_iplayers_user ON instance_players(user_id);

CREATE TABLE IF NOT EXISTS game_scores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID NOT NULL REFERENCES game_instances(id),
  user_id         UUID NOT NULL REFERENCES arena_users(id),
  raw_score       NUMERIC(12,4) NOT NULL DEFAULT 0,
  normalized_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  pnl             NUMERIC(12,4) NOT NULL DEFAULT 0,
  trade_count     INT NOT NULL DEFAULT 0,
  sortino_ratio   NUMERIC(10,6) NOT NULL DEFAULT 0,
  behavioral_score NUMERIC(8,4) NOT NULL DEFAULT 0,
  percentile      NUMERIC(6,2) NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_instance ON game_scores(instance_id);
CREATE INDEX IF NOT EXISTS idx_scores_user ON game_scores(user_id);

CREATE TABLE IF NOT EXISTS arena_conversion_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES arena_users(id),
  partner_id      UUID REFERENCES arena_users(id),
  template_id     UUID REFERENCES game_templates(id),
  instance_id     UUID REFERENCES game_instances(id),
  event_type      TEXT NOT NULL CHECK (event_type IN ('signup_click','redirect','registration','first_trade')),
  percentile_at_trigger NUMERIC(6,2) NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_conversion_user ON arena_conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_arena_conversion_partner ON arena_conversion_events(partner_id);

CREATE TABLE IF NOT EXISTS instance_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     UUID NOT NULL REFERENCES game_instances(id),
  user_id         UUID NOT NULL REFERENCES arena_users(id),
  contract_type   TEXT NOT NULL,
  market          TEXT NOT NULL,
  stake           NUMERIC(12,4) NOT NULL,
  payout          NUMERIC(12,4) NOT NULL DEFAULT 0,
  pnl             NUMERIC(12,4) NOT NULL DEFAULT 0,
  entry_price     NUMERIC(16,8),
  exit_price      NUMERIC(16,8),
  duration        INT NOT NULL DEFAULT 0,
  result          TEXT CHECK (result IN ('win','loss','pending','cancelled')),
  deriv_contract_id TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itrades_instance ON instance_trades(instance_id);
CREATE INDEX IF NOT EXISTS idx_itrades_user ON instance_trades(user_id);

CREATE TABLE IF NOT EXISTS partner_referral_clicks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    UUID NOT NULL REFERENCES arena_users(id),
  template_id   UUID NOT NULL REFERENCES game_templates(id),
  instance_id   UUID REFERENCES game_instances(id),
  user_id       UUID REFERENCES arena_users(id),
  source        TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('whatsapp','telegram','twitter','copy','direct')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_partner ON partner_referral_clicks(partner_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_template ON partner_referral_clicks(template_id);

ALTER TABLE arena_users ADD COLUMN IF NOT EXISTS current_win_streak INT NOT NULL DEFAULT 0;
ALTER TABLE arena_users ADD COLUMN IF NOT EXISTS best_win_streak INT NOT NULL DEFAULT 0;

-- Deriv Miles rewards tables (mirrored from backend/migrations/020_deriv_miles.up.sql
-- so that Next.js API routes can award XP/miles without depending on the Go migration step).
CREATE TABLE IF NOT EXISTS deriv_miles_balances (
  user_id          TEXT PRIMARY KEY,
  total_earned     DECIMAL(20,2) NOT NULL DEFAULT 0,
  current_balance  DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_spent      DECIMAL(20,2) NOT NULL DEFAULT 0,
  tier             TEXT NOT NULL DEFAULT 'bronze',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_tier CHECK (tier IN ('bronze','silver','gold','platinum')),
  CONSTRAINT valid_balances CHECK (
    total_earned >= 0 AND current_balance >= 0 AND total_spent >= 0
      AND current_balance = total_earned - total_spent
  )
);

CREATE INDEX IF NOT EXISTS idx_deriv_miles_balances_tier ON deriv_miles_balances(tier);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_balances_total_earned ON deriv_miles_balances(total_earned DESC);

CREATE TABLE IF NOT EXISTS deriv_miles_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          TEXT NOT NULL,
  transaction_type TEXT NOT NULL,
  amount           DECIMAL(20,2) NOT NULL,
  source_type      TEXT NOT NULL,
  source_id        TEXT,
  description      TEXT NOT NULL,
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('earn','spend','expire','refund')),
  CONSTRAINT valid_source_type CHECK (source_type IN ('xp','profitable_trade','competition_win','win_streak','daily_login','referral','manual','redemption')),
  CONSTRAINT valid_amount_sign CHECK (
    (transaction_type = 'earn' AND amount > 0) OR
    (transaction_type IN ('spend','expire') AND amount < 0) OR
    (transaction_type = 'refund' AND amount > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_deriv_miles_transactions_user ON deriv_miles_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_transactions_source ON deriv_miles_transactions(source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deriv_miles_transactions_idempotency
  ON deriv_miles_transactions(source_type, source_id)
  WHERE source_id IS NOT NULL AND transaction_type = 'earn';

CREATE TABLE IF NOT EXISTS deriv_miles_catalog (
  id              TEXT PRIMARY KEY,
  category        TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  miles_cost      DECIMAL(20,2) NOT NULL,
  stock_quantity  INTEGER,
  available       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB DEFAULT '{}',
  image_url       TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_category CHECK (category IN ('ai_analysis','premium_feature','third_party_tool','marketplace_item','trading_benefit')),
  CONSTRAINT valid_miles_cost CHECK (miles_cost > 0),
  CONSTRAINT valid_stock CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_deriv_miles_catalog_category ON deriv_miles_catalog(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_catalog_available ON deriv_miles_catalog(available, category);

CREATE TABLE IF NOT EXISTS deriv_miles_redemptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  redemption_type   TEXT NOT NULL,
  item_id           TEXT NOT NULL REFERENCES deriv_miles_catalog(id),
  miles_cost        DECIMAL(20,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  fulfillment_data  JSONB DEFAULT '{}',
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at      TIMESTAMPTZ,
  CONSTRAINT valid_redemption_type CHECK (redemption_type IN ('ai_analysis','premium_feature','third_party_tool','marketplace_item','trading_benefit')),
  CONSTRAINT valid_redemption_status CHECK (status IN ('pending','fulfilled','failed','refunded')),
  CONSTRAINT valid_miles_cost_positive CHECK (miles_cost > 0)
);

CREATE INDEX IF NOT EXISTS idx_deriv_miles_redemptions_user ON deriv_miles_redemptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_redemptions_item ON deriv_miles_redemptions(item_id);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_redemptions_created ON deriv_miles_redemptions(created_at DESC);

CREATE TABLE IF NOT EXISTS deriv_trading_copilot_entitlements (
  user_id TEXT PRIMARY KEY,
  credits_remaining INT NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT copilot_credits_nonneg CHECK (credits_remaining >= 0)
);
CREATE INDEX IF NOT EXISTS idx_trading_copilot_entitlements_expires ON deriv_trading_copilot_entitlements(expires_at);

INSERT INTO deriv_miles_catalog (id, category, name, description, miles_cost, stock_quantity, available, metadata, sort_order)
VALUES
  ('premium_trading_copilot', 'premium_feature', 'Trading Copilot',
   'Streaming AI assistant with Deriv context, charts, and structured widgets. Includes message credits for the access period.',
   2400, NULL, true, '{"feature":"trading_copilot","message_credits":600,"duration_days":30}'::jsonb, 40),
  ('ai_chart_analyst_5', 'third_party_tool', 'AI Chart Analyst — 5 credits',
   'Partner voucher for five AI-powered chart analysis credits.',
   500, NULL, true, '{"partner_url":"https://deriv.com"}'::jsonb, 41),
  ('ai_chart_analyst_20', 'third_party_tool', 'AI Chart Analyst — 20 credits',
   'Partner voucher for twenty AI-powered chart analysis credits.',
   1800, NULL, true, '{"partner_url":"https://deriv.com"}'::jsonb, 42),
  ('pro_trading_signals', 'third_party_tool', 'Pro Trading Signals (7 days)',
   'Partner voucher for seven days of curated Forex, Crypto & Indices signals.',
   1200, NULL, true, '{"partner_url":"https://deriv.com"}'::jsonb, 43)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION update_deriv_miles_tier()
RETURNS TRIGGER AS $fn$
BEGIN
  IF NEW.total_earned >= 10000 THEN
    NEW.tier := 'platinum';
  ELSIF NEW.total_earned >= 5000 THEN
    NEW.tier := 'gold';
  ELSIF NEW.total_earned >= 1000 THEN
    NEW.tier := 'silver';
  ELSE
    NEW.tier := 'bronze';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_deriv_miles_tier ON deriv_miles_balances;
CREATE TRIGGER trigger_update_deriv_miles_tier
  BEFORE UPDATE ON deriv_miles_balances
  FOR EACH ROW
  WHEN (OLD.total_earned IS DISTINCT FROM NEW.total_earned)
  EXECUTE FUNCTION update_deriv_miles_tier();

CREATE OR REPLACE FUNCTION check_deriv_miles_balance()
RETURNS TRIGGER AS $fn$
BEGIN
  IF NEW.current_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient miles balance';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_deriv_miles_balance ON deriv_miles_balances;
CREATE TRIGGER trigger_check_deriv_miles_balance
  BEFORE UPDATE ON deriv_miles_balances
  FOR EACH ROW
  EXECUTE FUNCTION check_deriv_miles_balance();
`;

const SEED_SQL = `
INSERT INTO arena_users (deriv_account_id, deriv_login_id, display_name, role)
VALUES
  ('DEMO_P1',      'DEMO_P1',      'Demo Player',  'player'),
  ('DEMO_PARTNER', 'DEMO_PARTNER', 'Demo Partner', 'partner'),
  ('DEMO_ADMIN',   'DEMO_ADMIN',   'Demo Admin',   'admin')
ON CONFLICT (deriv_account_id) DO NOTHING;
`;

export async function runMigrations(): Promise<string[]> {
  const log: string[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);
    log.push('Schema tables created');
    await client.query(SEED_SQL);
    log.push('Demo users seeded');
    await client.query('COMMIT');
    log.push('Migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : String(err);
    log.push(`Migration failed: ${message}`);
    throw err;
  } finally {
    client.release();
  }
  return log;
}
