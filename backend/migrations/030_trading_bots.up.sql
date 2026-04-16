-- AI Auto-Trading Bot System
-- Migration 030: Trading bots with XP/leveling, trades, analytics, and signal logs

CREATE TABLE IF NOT EXISTS trading_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'stopped',
    execution_mode TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    win_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    unlocked_features JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    CONSTRAINT valid_bot_status CHECK (status IN ('stopped', 'running', 'paused', 'error')),
    CONSTRAINT valid_execution_mode CHECK (execution_mode IN ('paper', 'demo_live')),
    CONSTRAINT valid_level CHECK (level >= 1 AND level <= 10),
    CONSTRAINT valid_xp CHECK (xp >= 0),
    CONSTRAINT valid_streaks CHECK (win_streak >= 0 AND best_streak >= 0)
);

CREATE INDEX IF NOT EXISTS idx_trading_bots_user_id ON trading_bots(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_bots_status ON trading_bots(status);
CREATE INDEX IF NOT EXISTS idx_trading_bots_level ON trading_bots(level DESC);

CREATE TABLE IF NOT EXISTS bot_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
    symbol TEXT NOT NULL,
    contract_type TEXT NOT NULL,
    side TEXT NOT NULL,
    stake DECIMAL(20,2) NOT NULL,
    payout DECIMAL(20,2),
    pnl DECIMAL(20,2),
    entry_price DECIMAL(20,8),
    exit_price DECIMAL(20,8),
    execution_mode TEXT NOT NULL,
    signal_sources JSONB NOT NULL DEFAULT '{}',
    deriv_contract_id TEXT,
    xp_gained INTEGER NOT NULL DEFAULT 0,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    CONSTRAINT valid_trade_side CHECK (side IN ('BUY', 'SELL')),
    CONSTRAINT valid_stake CHECK (stake > 0)
);

CREATE INDEX IF NOT EXISTS idx_bot_trades_bot_id ON bot_trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_bot_trades_executed_at ON bot_trades(executed_at DESC);

CREATE TABLE IF NOT EXISTS bot_analytics (
    bot_id UUID PRIMARY KEY REFERENCES trading_bots(id) ON DELETE CASCADE,
    total_trades INTEGER NOT NULL DEFAULT 0,
    winning_trades INTEGER NOT NULL DEFAULT 0,
    losing_trades INTEGER NOT NULL DEFAULT 0,
    total_pnl DECIMAL(20,2) NOT NULL DEFAULT 0,
    win_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
    avg_win DECIMAL(20,2) NOT NULL DEFAULT 0,
    avg_loss DECIMAL(20,2) NOT NULL DEFAULT 0,
    max_drawdown DECIMAL(20,2) NOT NULL DEFAULT 0,
    sharpe_ratio DECIMAL(10,4),
    profit_factor DECIMAL(10,4),
    last_trade_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bot_signals_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES trading_bots(id) ON DELETE CASCADE,
    signal_type TEXT NOT NULL,
    signal_data JSONB NOT NULL DEFAULT '{}',
    action_taken TEXT,
    confidence DECIMAL(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_bot_signal_action CHECK (action_taken IN ('trade_executed', 'ignored', 'conditions_not_met', 'below_threshold'))
);

CREATE INDEX IF NOT EXISTS idx_bot_signals_bot_id ON bot_signals_log(bot_id, created_at DESC);
