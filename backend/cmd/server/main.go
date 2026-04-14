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

	// Create router
	r := chi.NewRouter()
	
	// Middleware
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RealIP)
	
	// CORS (explicit origins; wildcard ports are not reliably supported)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"http://localhost:3001",
			"http://127.0.0.1:3001",
		},
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
	// Simple masking for logs
	if len(dbURL) > 30 {
		return dbURL[:30] + "..."
	}
	return "***"
}
