-- DerivArena Competition Schema

CREATE TABLE competitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    partner_id TEXT,
    partner_name TEXT,
    app_id TEXT,
    duration_hours INT NOT NULL,
    contract_types TEXT[] NOT NULL DEFAULT '{}',
    starting_balance DECIMAL(20,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    share_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'active', 'ended', 'cancelled'))
);

CREATE INDEX idx_competitions_status ON competitions(status);
CREATE INDEX idx_competitions_partner_id ON competitions(partner_id);
CREATE INDEX idx_competitions_start_time ON competitions(start_time);

CREATE TABLE participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    trader_id TEXT NOT NULL,
    trader_name TEXT,
    deriv_account_id TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(competition_id, trader_id)
);

CREATE INDEX idx_participants_competition_id ON participants(competition_id);
CREATE INDEX idx_participants_trader_id ON participants(trader_id);

CREATE TABLE competition_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    contract_type TEXT NOT NULL,
    symbol TEXT NOT NULL,
    stake DECIMAL(20,2) NOT NULL,
    payout DECIMAL(20,2),
    pnl DECIMAL(20,2),
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    contract_id TEXT
);

CREATE INDEX idx_competition_trades_competition_id ON competition_trades(competition_id);
CREATE INDEX idx_competition_trades_participant_id ON competition_trades(participant_id);
CREATE INDEX idx_competition_trades_executed_at ON competition_trades(executed_at);

CREATE TABLE competition_stats (
    participant_id UUID PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    total_trades INT NOT NULL DEFAULT 0,
    profitable_trades INT NOT NULL DEFAULT 0,
    total_pnl DECIMAL(20,2) NOT NULL DEFAULT 0,
    sortino_ratio DECIMAL(10,4),
    max_drawdown DECIMAL(10,4),
    current_balance DECIMAL(20,2) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_competition_stats_sortino ON competition_stats(sortino_ratio DESC NULLS LAST);

-- Named distinctly from arena funnel `conversion_events` (user_id / partner analytics in frontend migrate)
CREATE TABLE competition_conversion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    nudge_shown BOOLEAN NOT NULL DEFAULT false,
    clicked BOOLEAN NOT NULL DEFAULT false,
    converted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_trigger CHECK (trigger_type IN ('top_25', 'win_streak', 'exotic_mastery', 'competition_win'))
);

CREATE INDEX idx_competition_conversion_events_participant ON competition_conversion_events(participant_id);
CREATE INDEX idx_competition_conversion_events_trigger ON competition_conversion_events(trigger_type);
