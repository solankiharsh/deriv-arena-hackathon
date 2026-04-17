-- Trading Copilot entitlements (message credits + access window)

CREATE TABLE deriv_trading_copilot_entitlements (
    user_id TEXT PRIMARY KEY,
    credits_remaining INT NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trading_copilot_entitlements_expires ON deriv_trading_copilot_entitlements(expires_at);

-- Marketplace catalog rows (IDs aligned with frontend marketplace)

INSERT INTO deriv_miles_catalog (id, category, name, description, miles_cost, stock_quantity, available, metadata, sort_order) VALUES
(
    'premium_trading_copilot',
    'premium_feature',
    'Trading Copilot',
    'Streaming AI assistant with live Deriv context, charts, and structured trade insights. Includes message credits for the access period.',
    2400,
    NULL,
    true,
    '{"feature":"trading_copilot","message_credits":600,"duration_days":30}'::jsonb,
    40
),
(
    'ai_chart_analyst_5',
    'third_party_tool',
    'AI Chart Analyst — 5 credits',
    'Partner voucher for five AI-powered chart analysis credits.',
    500,
    NULL,
    true,
    '{"partner_url":"https://deriv.com"}'::jsonb,
    41
),
(
    'ai_chart_analyst_20',
    'third_party_tool',
    'AI Chart Analyst — 20 credits',
    'Partner voucher for twenty AI-powered chart analysis credits.',
    1800,
    NULL,
    true,
    '{"partner_url":"https://deriv.com"}'::jsonb,
    42
),
(
    'pro_trading_signals',
    'third_party_tool',
    'Pro Trading Signals (7 days)',
    'Partner voucher for seven days of curated Forex, Crypto & Indices signals.',
    1200,
    NULL,
    true,
    '{"partner_url":"https://deriv.com"}'::jsonb,
    43
)
ON CONFLICT (id) DO NOTHING;
