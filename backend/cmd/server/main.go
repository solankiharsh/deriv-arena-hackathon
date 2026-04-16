package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"derivarena/internal/actionbus"
	"derivarena/internal/competition"
	"derivarena/internal/derivmiles"
	"derivarena/internal/marketdata"
	"derivarena/internal/marketdata/deriv"
	"derivarena/internal/tradingbot"
)

func main() {
	// Initialize logger
	logger, err := zap.NewProduction()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	log := logger.Sugar()

	var mdSource *deriv.Source
	defer func() {
		if mdSource != nil {
			mdSource.Close()
		}
	}()

	var mdHealth struct {
		sync.Mutex
		Enabled      bool
		LastRun      time.Time
		LastErr      string
		SuccessItems []string
		FailedItems  []string
	}

	// Read environment
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL not set")
	}

	httpPort := os.Getenv("PORT")
	if httpPort == "" {
		httpPort = "8090"
	}

	// SHARE_BASE_URL is the public URL of the Next.js frontend, used to build
	// /join/{id} links that land on the UI, not the API server.
	shareBaseURL := os.Getenv("SHARE_BASE_URL")
	if shareBaseURL == "" {
		shareBaseURL = "http://localhost:3000"
	}

	// Signal context
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Connect to database
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}
	log.Infow("Connected to database", "url", maskPassword(dbURL))

	// Auto-migrate on startup — idempotent, safe to run every deploy.
	if err := runMigrations(ctx, pool, log); err != nil {
		log.Fatalw("Migration failed", "error", err)
	}
	log.Infow("Database migrations applied")

	// Create router
	r := chi.NewRouter()
	
	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	
	// CORS — read allowed origins from env (comma-separated) and merge with defaults.
	corsOrigins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:3001",
		"http://127.0.0.1:3001",
	}
	if extra := os.Getenv("CORS_ORIGINS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			o = strings.TrimSpace(o)
			if o != "" {
				corsOrigins = append(corsOrigins, o)
			}
		}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   corsOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check (includes optional market data pipeline status)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		payload := map[string]interface{}{
			"status":  "ok",
			"service": "derivarena",
		}
		mdHealth.Lock()
		if mdHealth.Enabled {
			payload["marketdata"] = map[string]interface{}{
				"enabled":       true,
				"last_run":      mdHealth.LastRun.UTC().Format(time.RFC3339Nano),
				"last_error":    mdHealth.LastErr,
				"success_items": mdHealth.SuccessItems,
				"failed_items":  mdHealth.FailedItems,
			}
		} else {
			payload["marketdata"] = map[string]interface{}{"enabled": false}
		}
		mdHealth.Unlock()
		_ = json.NewEncoder(w).Encode(payload)
	})

	// Deriv Miles service (create first so we can inject into competition service)
	milesSvc := derivmiles.NewService(logger.Named("derivmiles"), pool)
	milesSvc.RegisterRoutes(r)
	log.Infow("Deriv Miles Rewards API enabled")

	// Competition service
	compSvc := competition.NewService(logger.Named("competition"), pool, shareBaseURL)
	compSvc.SetMilesEngine(milesSvc.GetEngine())
	compSvc.RegisterRoutes(r)
	log.Infow("DerivArena Competition API enabled", "share_base_url", shareBaseURL)

	// Start auto-end task in background
	go compSvc.StartAutoEndTask(ctx)

	// Trading Bot service (AI Auto-Trading Command Center)
	botSvc := tradingbot.NewService(logger.Named("tradingbot"), pool)
	botSvc.RegisterRoutes(r)
	log.Infow("AI Auto-Trading Bot Command Center enabled")

	// Optional: public Deriv market data collector + action bus (set MARKETDATA_ENABLED=1)
	if os.Getenv("MARKETDATA_ENABLED") == "1" || os.Getenv("MARKETDATA_ENABLED") == "true" {
		mdSource = deriv.NewSource(logger.Named("deriv_public_md"))
		coll := marketdata.NewCollector(logger.Named("marketdata"), mdSource)
		bus := actionbus.NewRouter(logger.Named("actionbus"))
		bus.Register(actionbus.SignalMarketSnapshot, func(_ context.Context, sig actionbus.ActionSignal) error {
			if sig.Snapshot == nil {
				return nil
			}
			logger.Debug("market snapshot",
				zap.Int("tickers", len(sig.Snapshot.Tickers)),
				zap.Strings("success", sig.Snapshot.Meta.SuccessItems),
				zap.Strings("failed", sig.Snapshot.Meta.FailedItems),
			)
			return nil
		})

		intervalSec := 15
		if v := os.Getenv("MARKETDATA_INTERVAL_SEC"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n >= 2 {
				intervalSec = n
			}
		}
		symbols := marketdata.ParseCanonicalMarkets(os.Getenv("MARKETDATA_SYMBOLS"))
		candleMarket := symbols[0]
		candleLimit := 60
		if v := os.Getenv("MARKETDATA_CANDLE_LIMIT"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 1000 {
				candleLimit = n
			}
		}
		opts := marketdata.CollectOptions{
			CanonicalMarkets: symbols,
			CandleMarket:     candleMarket,
			CandleInterval:   marketdata.Interval1m,
			CandleLimit:      candleLimit,
			IncludeMarkets:   os.Getenv("MARKETDATA_INCLUDE_MARKETS") == "1",
		}
		runner := marketdata.NewBackgroundRunner(logger.Named("md_runner"), coll, time.Duration(intervalSec)*time.Second,
			func(c context.Context, snap *marketdata.MarketSnapshot) {
				mdHealth.Lock()
				mdHealth.Enabled = true
				mdHealth.LastRun = time.Now().UTC()
				if len(snap.Meta.FailedItems) > 0 {
					mdHealth.LastErr = strings.Join(snap.Meta.FailedItems, ",")
				} else {
					mdHealth.LastErr = ""
				}
				mdHealth.SuccessItems = append([]string(nil), snap.Meta.SuccessItems...)
				mdHealth.FailedItems = append([]string(nil), snap.Meta.FailedItems...)
				mdHealth.Unlock()
				bus.DispatchSnapshot(c, snap)
			},
		)
		mdHealth.Lock()
		mdHealth.Enabled = true
		mdHealth.Unlock()
		go runner.Start(ctx, opts)
		log.Infow("Market data pipeline started",
			"interval_sec", intervalSec,
			"symbols", symbols,
			"candle_market", candleMarket,
		)
	}

	// Start HTTP server
	addr := ":" + httpPort
	server := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// Start server in goroutine
	go func() {
		log.Infow("HTTP server starting", "addr", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalw("HTTP server error", "error", err)
		}
	}()

	// Wait for interrupt
	<-ctx.Done()
	log.Info("Shutting down...")

	// Graceful shutdown
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Errorw("Server shutdown error", "error", err)
	}

	log.Info("Server stopped")
}

func maskPassword(dbURL string) string {
	if len(dbURL) > 30 {
		return dbURL[:30] + "..."
	}
	return "***"
}

// If an older DB created `conversion_events` for competition nudges (participant_id, trigger_type, …),
// rename it so the arena funnel table `conversion_events` (user_id, partner_id, …) can be created.
const legacyConversionEventsFixSQL = `
DO $legacy$
BEGIN
	IF EXISTS (
		SELECT 1 FROM information_schema.columns
		WHERE table_schema = 'public' AND table_name = 'conversion_events' AND column_name = 'participant_id'
	) AND NOT EXISTS (
		SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'competition_conversion_events'
	) THEN
		ALTER TABLE conversion_events RENAME TO competition_conversion_events;
	END IF;
END
$legacy$;
`

const migrationSQL = `
-- Backend competition schema (idempotent)
CREATE TABLE IF NOT EXISTS competitions (
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

CREATE INDEX IF NOT EXISTS idx_competitions_status ON competitions(status);
CREATE INDEX IF NOT EXISTS idx_competitions_partner_id ON competitions(partner_id);
CREATE INDEX IF NOT EXISTS idx_competitions_start_time ON competitions(start_time);

CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    trader_id TEXT NOT NULL,
    trader_name TEXT,
    deriv_account_id TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(competition_id, trader_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_competition_id ON participants(competition_id);
CREATE INDEX IF NOT EXISTS idx_participants_trader_id ON participants(trader_id);

CREATE TABLE IF NOT EXISTS competition_trades (
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

CREATE INDEX IF NOT EXISTS idx_competition_trades_competition_id ON competition_trades(competition_id);
CREATE INDEX IF NOT EXISTS idx_competition_trades_participant_id ON competition_trades(participant_id);
CREATE INDEX IF NOT EXISTS idx_competition_trades_executed_at ON competition_trades(executed_at);

CREATE TABLE IF NOT EXISTS competition_stats (
    participant_id UUID PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    total_trades INT NOT NULL DEFAULT 0,
    profitable_trades INT NOT NULL DEFAULT 0,
    total_pnl DECIMAL(20,2) NOT NULL DEFAULT 0,
    sortino_ratio DECIMAL(10,4),
    max_drawdown DECIMAL(10,4),
    current_balance DECIMAL(20,2) NOT NULL,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competition_stats_sortino ON competition_stats(sortino_ratio DESC NULLS LAST);

-- Competition nudge / conversion tracking (distinct from arena funnel conversion_events below)
CREATE TABLE IF NOT EXISTS competition_conversion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    trigger_type TEXT NOT NULL,
    nudge_shown BOOLEAN NOT NULL DEFAULT false,
    clicked BOOLEAN NOT NULL DEFAULT false,
    converted BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_competition_conversion_trigger CHECK (trigger_type IN ('top_25', 'win_streak', 'exotic_mastery', 'competition_win'))
);

CREATE INDEX IF NOT EXISTS idx_competition_conversion_events_participant ON competition_conversion_events(participant_id);
CREATE INDEX IF NOT EXISTS idx_competition_conversion_events_trigger ON competition_conversion_events(trigger_type);

-- Frontend arena schema (idempotent)
CREATE TABLE IF NOT EXISTS arena_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deriv_account_id TEXT UNIQUE NOT NULL,
    deriv_login_id TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('player','partner','admin')),
    arena_rating NUMERIC(8,2) NOT NULL DEFAULT 0,
    total_games INT NOT NULL DEFAULT 0,
    total_wins INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    game_mode TEXT NOT NULL CHECK (game_mode IN ('classic','phantom_league','boxing_ring','anti_you','war_room','behavioral_xray')),
    created_by UUID NOT NULL REFERENCES arena_users(id),
    config JSONB NOT NULL DEFAULT '{}',
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    play_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_mode ON game_templates(game_mode);
CREATE INDEX IF NOT EXISTS idx_templates_creator ON game_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_slug ON game_templates(slug);

CREATE TABLE IF NOT EXISTS game_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES game_templates(id),
    template_slug TEXT NOT NULL,
    started_by UUID NOT NULL REFERENCES arena_users(id),
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','live','finished','cancelled')),
    started_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    player_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instances_template ON game_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_instances_status ON game_instances(status);

CREATE TABLE IF NOT EXISTS instance_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES game_instances(id),
    user_id UUID NOT NULL REFERENCES arena_users(id),
    referred_by UUID REFERENCES arena_users(id),
    score NUMERIC(12,4) NOT NULL DEFAULT 0,
    normalized_score NUMERIC(8,4) NOT NULL DEFAULT 0,
    rank INT NOT NULL DEFAULT 0,
    trades_count INT NOT NULL DEFAULT 0,
    pnl NUMERIC(12,4) NOT NULL DEFAULT 0,
    behavioral_score NUMERIC(8,4) NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(instance_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_iplayers_instance ON instance_players(instance_id);
CREATE INDEX IF NOT EXISTS idx_iplayers_user ON instance_players(user_id);

CREATE TABLE IF NOT EXISTS game_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES game_instances(id),
    user_id UUID NOT NULL REFERENCES arena_users(id),
    raw_score NUMERIC(12,4) NOT NULL DEFAULT 0,
    normalized_score NUMERIC(8,4) NOT NULL DEFAULT 0,
    pnl NUMERIC(12,4) NOT NULL DEFAULT 0,
    trade_count INT NOT NULL DEFAULT 0,
    sortino_ratio NUMERIC(10,6) NOT NULL DEFAULT 0,
    behavioral_score NUMERIC(8,4) NOT NULL DEFAULT 0,
    percentile NUMERIC(6,2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_instance ON game_scores(instance_id);
CREATE INDEX IF NOT EXISTS idx_scores_user ON game_scores(user_id);

CREATE TABLE IF NOT EXISTS partner_referral_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES arena_users(id),
    template_id UUID NOT NULL REFERENCES game_templates(id),
    instance_id UUID REFERENCES game_instances(id),
    user_id UUID REFERENCES arena_users(id),
    source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('whatsapp','telegram','twitter','copy','direct')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_clicks_partner ON partner_referral_clicks(partner_id);
CREATE INDEX IF NOT EXISTS idx_referral_clicks_template ON partner_referral_clicks(template_id);

CREATE TABLE IF NOT EXISTS instance_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES game_instances(id),
    user_id UUID NOT NULL REFERENCES arena_users(id),
    contract_type TEXT NOT NULL,
    market TEXT NOT NULL,
    stake NUMERIC(12,4) NOT NULL,
    payout NUMERIC(12,4) NOT NULL DEFAULT 0,
    pnl NUMERIC(12,4) NOT NULL DEFAULT 0,
    entry_price NUMERIC(16,8),
    exit_price NUMERIC(16,8),
    duration INT NOT NULL DEFAULT 0,
    result TEXT CHECK (result IN ('win','loss','pending','cancelled')),
    deriv_contract_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_itrades_instance ON instance_trades(instance_id);
CREATE INDEX IF NOT EXISTS idx_itrades_user ON instance_trades(user_id);

CREATE TABLE IF NOT EXISTS conversion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES arena_users(id),
    partner_id UUID REFERENCES arena_users(id),
    template_id UUID REFERENCES game_templates(id),
    instance_id UUID REFERENCES game_instances(id),
    event_type TEXT NOT NULL CHECK (event_type IN ('signup_click','redirect','registration','first_trade')),
    percentile_at_trigger NUMERIC(6,2) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversion_user ON conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_partner ON conversion_events(partner_id);

-- Deriv Miles schema (idempotent)
CREATE TABLE IF NOT EXISTS deriv_miles_balances (
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

CREATE INDEX IF NOT EXISTS idx_deriv_miles_balances_tier ON deriv_miles_balances(tier);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_balances_total_earned ON deriv_miles_balances(total_earned DESC);

CREATE TABLE IF NOT EXISTS deriv_miles_transactions (
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

CREATE INDEX IF NOT EXISTS idx_deriv_miles_transactions_user ON deriv_miles_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_transactions_source ON deriv_miles_transactions(source_type, source_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_deriv_miles_transactions_idempotency ON deriv_miles_transactions(source_type, source_id) WHERE source_id IS NOT NULL AND transaction_type = 'earn';

CREATE TABLE IF NOT EXISTS deriv_miles_catalog (
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
    CONSTRAINT valid_miles_category CHECK (category IN ('ai_analysis', 'premium_feature', 'third_party_tool', 'marketplace_item', 'trading_benefit')),
    CONSTRAINT valid_miles_cost CHECK (miles_cost > 0),
    CONSTRAINT valid_stock CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_deriv_miles_catalog_category ON deriv_miles_catalog(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_catalog_available ON deriv_miles_catalog(available, category);

CREATE TABLE IF NOT EXISTS deriv_miles_redemptions (
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

CREATE INDEX IF NOT EXISTS idx_deriv_miles_redemptions_user ON deriv_miles_redemptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_redemptions_item ON deriv_miles_redemptions(item_id);
CREATE INDEX IF NOT EXISTS idx_deriv_miles_redemptions_created ON deriv_miles_redemptions(created_at DESC);

CREATE TABLE IF NOT EXISTS deriv_miles_earning_rules (
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

CREATE INDEX IF NOT EXISTS idx_deriv_miles_earning_rules_active ON deriv_miles_earning_rules(active, priority);

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

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_deriv_miles_tier') THEN
        CREATE TRIGGER trigger_update_deriv_miles_tier
            BEFORE UPDATE ON deriv_miles_balances
            FOR EACH ROW
            WHEN (OLD.total_earned IS DISTINCT FROM NEW.total_earned)
            EXECUTE FUNCTION update_deriv_miles_tier();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION check_deriv_miles_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.current_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient miles balance';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_check_deriv_miles_balance') THEN
        CREATE TRIGGER trigger_check_deriv_miles_balance
            BEFORE UPDATE ON deriv_miles_balances
            FOR EACH ROW
            EXECUTE FUNCTION check_deriv_miles_balance();
    END IF;
END $$;

-- Seed earning rules (idempotent)
INSERT INTO deriv_miles_earning_rules (id, rule_type, miles_formula, conditions, active, priority, description) VALUES
('xp_conversion',    'xp',              '{{xp}} / 10',                              '{"conversion_rate": 10}',          true, 1, 'Convert XP to miles: 10 XP = 1 mile'),
('profitable_trade', 'profitable_trade','CLAMP(({{pnl}} / 100) * 0.5, 1, 50)',      '{"min": 1, "max": 50, "multiplier": 0.005}', true, 2, 'Earn miles from profitable trades'),
('competition_win',  'competition_win', '500',                                       '{"position": 1}',                  true, 3, 'Win first place: 500 miles'),
('competition_top3', 'competition_win', '200',                                       '{"position": [2, 3]}',             true, 4, 'Finish top 3: 200 miles'),
('win_streak_5',     'win_streak',      '100',                                       '{"streak_length": 5}',             true, 5, '5-trade win streak: 100 miles'),
('win_streak_10',    'win_streak',      '250',                                       '{"streak_length": 10}',            true, 6, '10-trade win streak: 250 miles'),
('daily_login',      'daily_login',     '5',                                         '{}',                               true, 7, 'Daily login bonus: 5 miles')
ON CONFLICT (id) DO NOTHING;

-- Seed catalog (idempotent)
INSERT INTO deriv_miles_catalog (id, category, name, description, miles_cost, stock_quantity, available, metadata, sort_order) VALUES
('ai_analysis_basic',        'ai_analysis',    'Basic AI Trade Analysis',           'AI-powered analysis of one trade',                                      50,  NULL, true, '{"analysis_depth":"basic","trades_analyzed":1}',              1),
('ai_analysis_advanced',     'ai_analysis',    'Advanced AI Coaching Session',      'Deep dive into your last 5 trades',                                    200,  NULL, true, '{"analysis_depth":"advanced","trades_analyzed":5}',           2),
('ai_weekly_report',         'ai_analysis',    'Weekly Performance Report',         'Comprehensive weekly AI breakdown',                                    500,  NULL, true, '{"analysis_depth":"comprehensive","period":"weekly"}',         3),
('premium_charts_week',      'premium_feature','Advanced Charts (1 Week)',           'Unlock advanced charting tools for 7 days',                            100,  NULL, true, '{"feature":"advanced_charts","duration_days":7}',             11),
('premium_alerts_month',     'premium_feature','Price Alerts (1 Month)',             'Custom price alerts for 30 days',                                       50,  NULL, true, '{"feature":"price_alerts","duration_days":30}',               12),
('premium_competition_entry','premium_feature','Exclusive Competition Entry',        'Access to one premium-only competition',                               200,  NULL, true, '{"feature":"exclusive_competition","uses":1}',                13),
('premium_ad_free_month',    'premium_feature','Ad-Free Experience (1 Month)',       'Remove all ads for 30 days',                                           150,  NULL, true, '{"feature":"ad_free","duration_days":30}',                    14),
('avatar_gold_trader',       'marketplace_item','Gold Trader Avatar',               'Exclusive gold-tier avatar badge',                                      75,  NULL, true, '{"item_type":"avatar","rarity":"gold"}',                      21),
('theme_dark_pro',           'marketplace_item','Dark Pro Theme',                   'Sleek professional dark theme',                                         50,  NULL, true, '{"item_type":"theme","theme_id":"dark_pro"}',                 22),
('celebration_fireworks',    'marketplace_item','Fireworks Celebration',            'Animated fireworks on winning trades',                                  25,  NULL, true, '{"item_type":"animation","animation_id":"fireworks"}',        23),
('leaderboard_highlight',    'marketplace_item','Leaderboard Name Highlight',       'Your name stands out in gold on leaderboards',                         75,  NULL, true, '{"item_type":"highlight","color":"gold"}',                    24),
('trading_bonus_balance',    'trading_benefit','Bonus Starting Balance (+$1000)',    'Start next competition with extra $1000 demo balance',                 500,  NULL, true, '{"benefit_type":"bonus_balance","amount":1000}',              31),
('trading_fee_waiver',       'trading_benefit','Fee Waiver (10 Trades)',             'Reduced fees on next 10 trades',                                       100,  NULL, true, '{"benefit_type":"fee_waiver","trades":10}',                   32),
('trading_exotic_access',    'trading_benefit','Exotic Contracts Unlock',           'Access exotic contract types for next competition',                    200,  NULL, true, '{"benefit_type":"exotic_access","duration_competitions":1}',  33),
('trading_instant_replay',   'trading_benefit','Instant Replay Token',              'Reset one losing position',                                             50,  NULL, true, '{"benefit_type":"instant_replay","uses":1}',                  34)
ON CONFLICT (id) DO NOTHING;

-- Seed demo users (idempotent)
INSERT INTO arena_users (deriv_account_id, deriv_login_id, display_name, role)
VALUES
    ('DEMO_P1',      'DEMO_P1',      'Demo Player',  'player'),
    ('DEMO_PARTNER', 'DEMO_PARTNER', 'Demo Partner', 'partner'),
    ('DEMO_ADMIN',   'DEMO_ADMIN',   'Demo Admin',   'admin')
ON CONFLICT (deriv_account_id) DO NOTHING;

-- Trading bot tables (idempotent)
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
`

func runMigrations(ctx context.Context, pool *pgxpool.Pool, log *zap.SugaredLogger) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, legacyConversionEventsFixSQL); err != nil {
		return fmt.Errorf("legacy conversion_events rename: %w", err)
	}
	if _, err := conn.Exec(ctx, migrationSQL); err != nil {
		return fmt.Errorf("execute migration: %w", err)
	}
	return nil
}
