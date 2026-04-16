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
	"derivarena/internal/marketdata"
	"derivarena/internal/marketdata/deriv"
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

	// Competition service
	compSvc := competition.NewService(logger.Named("competition"), pool, shareBaseURL)
	compSvc.RegisterRoutes(r)
	log.Infow("DerivArena Competition API enabled", "share_base_url", shareBaseURL)

	// Start auto-end task in background
	go compSvc.StartAutoEndTask(ctx)

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

-- Seed demo users (idempotent)
INSERT INTO arena_users (deriv_account_id, deriv_login_id, display_name, role)
VALUES
    ('DEMO_P1',      'DEMO_P1',      'Demo Player',  'player'),
    ('DEMO_PARTNER', 'DEMO_PARTNER', 'Demo Partner', 'partner'),
    ('DEMO_ADMIN',   'DEMO_ADMIN',   'Demo Admin',   'admin')
ON CONFLICT (deriv_account_id) DO NOTHING;
`

func runMigrations(ctx context.Context, pool *pgxpool.Pool, log *zap.SugaredLogger) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, migrationSQL); err != nil {
		return fmt.Errorf("execute migration: %w", err)
	}
	return nil
}
