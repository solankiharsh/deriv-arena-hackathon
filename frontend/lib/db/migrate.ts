import { pool } from './postgres';

const SCHEMA_SQL = `
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

CREATE TABLE IF NOT EXISTS conversion_events (
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

CREATE INDEX IF NOT EXISTS idx_conversion_user ON conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_partner ON conversion_events(partner_id);

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
`;

export async function runMigrations(): Promise<string[]> {
  const log: string[] = [];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(SCHEMA_SQL);
    await client.query('COMMIT');
    log.push('Schema migration completed successfully');
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
