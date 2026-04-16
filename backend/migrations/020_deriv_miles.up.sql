-- Deriv Miles Rewards System

-- Table 1: User Miles Balances
CREATE TABLE deriv_miles_balances (
    user_id TEXT PRIMARY KEY,
    total_earned DECIMAL(20,2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(20,2) NOT NULL DEFAULT 0,
    total_spent DECIMAL(20,2) NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'bronze',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_tier CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    CONSTRAINT valid_balances CHECK (
        total_earned >= 0 AND 
        current_balance >= 0 AND 
        total_spent >= 0 AND
        current_balance = total_earned - total_spent
    )
);

CREATE INDEX idx_deriv_miles_balances_tier ON deriv_miles_balances(tier);
CREATE INDEX idx_deriv_miles_balances_total_earned ON deriv_miles_balances(total_earned DESC);

-- Table 2: Miles Transactions
CREATE TABLE deriv_miles_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    amount DECIMAL(20,2) NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('earn', 'spend', 'expire', 'refund')),
    CONSTRAINT valid_source_type CHECK (source_type IN ('xp', 'profitable_trade', 'competition_win', 'win_streak', 'daily_login', 'referral', 'manual', 'redemption')),
    CONSTRAINT valid_amount_sign CHECK (
        (transaction_type = 'earn' AND amount > 0) OR
        (transaction_type IN ('spend', 'expire') AND amount < 0) OR
        (transaction_type = 'refund' AND amount > 0)
    )
);

CREATE INDEX idx_deriv_miles_transactions_user ON deriv_miles_transactions(user_id, created_at DESC);
CREATE INDEX idx_deriv_miles_transactions_source ON deriv_miles_transactions(source_type, source_id);
CREATE UNIQUE INDEX idx_deriv_miles_transactions_idempotency ON deriv_miles_transactions(source_type, source_id) WHERE source_id IS NOT NULL AND transaction_type = 'earn';

-- Table 3: Redemption Catalog
CREATE TABLE deriv_miles_catalog (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    miles_cost DECIMAL(20,2) NOT NULL,
    stock_quantity INTEGER,
    available BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB DEFAULT '{}',
    image_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_category CHECK (category IN ('ai_analysis', 'premium_feature', 'third_party_tool', 'marketplace_item', 'trading_benefit')),
    CONSTRAINT valid_miles_cost CHECK (miles_cost > 0),
    CONSTRAINT valid_stock CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
);

CREATE INDEX idx_deriv_miles_catalog_category ON deriv_miles_catalog(category, sort_order);
CREATE INDEX idx_deriv_miles_catalog_available ON deriv_miles_catalog(available, category);

-- Table 4: Redemptions
CREATE TABLE deriv_miles_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    redemption_type TEXT NOT NULL,
    item_id TEXT NOT NULL REFERENCES deriv_miles_catalog(id),
    miles_cost DECIMAL(20,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    fulfillment_data JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fulfilled_at TIMESTAMPTZ,
    CONSTRAINT valid_redemption_type CHECK (redemption_type IN ('ai_analysis', 'premium_feature', 'third_party_tool', 'marketplace_item', 'trading_benefit')),
    CONSTRAINT valid_redemption_status CHECK (status IN ('pending', 'fulfilled', 'failed', 'refunded')),
    CONSTRAINT valid_miles_cost_positive CHECK (miles_cost > 0)
);

CREATE INDEX idx_deriv_miles_redemptions_user ON deriv_miles_redemptions(user_id, status);
CREATE INDEX idx_deriv_miles_redemptions_item ON deriv_miles_redemptions(item_id);
CREATE INDEX idx_deriv_miles_redemptions_created ON deriv_miles_redemptions(created_at DESC);

-- Table 5: Earning Rules
CREATE TABLE deriv_miles_earning_rules (
    id TEXT PRIMARY KEY,
    rule_type TEXT NOT NULL,
    miles_formula TEXT NOT NULL,
    conditions JSONB DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_deriv_miles_earning_rules_active ON deriv_miles_earning_rules(active, priority);

-- Seed initial earning rules
INSERT INTO deriv_miles_earning_rules (id, rule_type, miles_formula, conditions, active, priority, description) VALUES
('xp_conversion', 'xp', '{{xp}} / 10', '{"conversion_rate": 10}', true, 1, 'Convert XP to miles: 10 XP = 1 mile'),
('profitable_trade', 'profitable_trade', 'CLAMP(({{pnl}} / 100) * 0.5, 1, 50)', '{"min": 1, "max": 50, "multiplier": 0.005}', true, 2, 'Earn miles from profitable trades: (PnL / 100) * 0.5, capped between 1-50 miles'),
('competition_win', 'competition_win', '500', '{"position": 1}', true, 3, 'Win first place in a competition: 500 miles'),
('competition_top3', 'competition_win', '200', '{"position": [2, 3]}', true, 4, 'Finish in top 3: 200 miles'),
('win_streak_5', 'win_streak', '100', '{"streak_length": 5}', true, 5, '5-trade win streak: 100 miles'),
('win_streak_10', 'win_streak', '250', '{"streak_length": 10}', true, 6, '10-trade win streak: 250 miles'),
('daily_login', 'daily_login', '5', '{}', true, 7, 'Daily login bonus: 5 miles');

-- Seed initial catalog items
INSERT INTO deriv_miles_catalog (id, category, name, description, miles_cost, stock_quantity, available, metadata, sort_order) VALUES
-- AI Analysis
('ai_analysis_basic', 'ai_analysis', 'Basic AI Trade Analysis', 'Get AI-powered analysis of one trade with actionable insights', 50, NULL, true, '{"analysis_depth": "basic", "trades_analyzed": 1}', 1),
('ai_analysis_advanced', 'ai_analysis', 'Advanced AI Coaching Session', 'Deep dive into your last 5 trades with personalized strategy recommendations', 200, NULL, true, '{"analysis_depth": "advanced", "trades_analyzed": 5}', 2),
('ai_weekly_report', 'ai_analysis', 'Weekly Performance Report', 'Comprehensive weekly breakdown with AI insights and improvement areas', 500, NULL, true, '{"analysis_depth": "comprehensive", "period": "weekly"}', 3),

-- Premium Features
('premium_charts_week', 'premium_feature', 'Advanced Charts (1 Week)', 'Unlock advanced charting tools and indicators for 7 days', 100, NULL, true, '{"feature": "advanced_charts", "duration_days": 7}', 11),
('premium_alerts_month', 'premium_feature', 'Price Alerts (1 Month)', 'Set custom price alerts for 30 days', 50, NULL, true, '{"feature": "price_alerts", "duration_days": 30}', 12),
('premium_competition_entry', 'premium_feature', 'Exclusive Competition Entry', 'Access to one premium-only competition', 200, NULL, true, '{"feature": "exclusive_competition", "uses": 1}', 13),
('premium_ad_free_month', 'premium_feature', 'Ad-Free Experience (1 Month)', 'Remove all ads for 30 days', 150, NULL, true, '{"feature": "ad_free", "duration_days": 30}', 14),

-- Marketplace Items
('avatar_gold_trader', 'marketplace_item', 'Gold Trader Avatar', 'Exclusive gold-tier avatar badge', 75, NULL, true, '{"item_type": "avatar", "rarity": "gold"}', 21),
('theme_dark_pro', 'marketplace_item', 'Dark Pro Theme', 'Sleek professional dark theme', 50, NULL, true, '{"item_type": "theme", "theme_id": "dark_pro"}', 22),
('celebration_fireworks', 'marketplace_item', 'Fireworks Celebration', 'Animated fireworks on winning trades', 25, NULL, true, '{"item_type": "animation", "animation_id": "fireworks"}', 23),
('leaderboard_highlight', 'marketplace_item', 'Leaderboard Name Highlight', 'Your name stands out in gold on leaderboards', 75, NULL, true, '{"item_type": "highlight", "color": "gold"}', 24),

-- Trading Benefits
('trading_bonus_balance', 'trading_benefit', 'Bonus Starting Balance (+$1000)', 'Start your next competition with extra $1000 demo balance', 500, NULL, true, '{"benefit_type": "bonus_balance", "amount": 1000}', 31),
('trading_fee_waiver', 'trading_benefit', 'Fee Waiver (10 Trades)', 'Reduced fees on your next 10 trades', 100, NULL, true, '{"benefit_type": "fee_waiver", "trades": 10}', 32),
('trading_exotic_access', 'trading_benefit', 'Exotic Contracts Unlock', 'Access exotic contract types for your next competition', 200, NULL, true, '{"benefit_type": "exotic_access", "duration_competitions": 1}', 33),
('trading_instant_replay', 'trading_benefit', 'Instant Replay Token', 'Reset one losing position (use once)', 50, NULL, true, '{"benefit_type": "instant_replay", "uses": 1}', 34);

-- Function to update tier based on total earned
CREATE OR REPLACE FUNCTION update_deriv_miles_tier()
RETURNS TRIGGER AS $$
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
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deriv_miles_tier
    BEFORE UPDATE ON deriv_miles_balances
    FOR EACH ROW
    WHEN (OLD.total_earned IS DISTINCT FROM NEW.total_earned)
    EXECUTE FUNCTION update_deriv_miles_tier();

-- Function to ensure balance integrity
CREATE OR REPLACE FUNCTION check_deriv_miles_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient miles balance';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_deriv_miles_balance
    BEFORE UPDATE ON deriv_miles_balances
    FOR EACH ROW
    EXECUTE FUNCTION check_deriv_miles_balance();
