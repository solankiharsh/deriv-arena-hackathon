package tradingbot

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// Service exposes trading-bot HTTP + WebSocket endpoints.
type Service struct {
	log      *zap.Logger
	store    *Store
	engine   *BotEngine
	upgrader websocket.Upgrader
}

// NewService wires everything.
func NewService(log *zap.Logger, pool *pgxpool.Pool) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	store := NewStore(pool)
	indicators := NewIndicatorCalculator()
	news := NewNewsCollector(log.Named("news"))
	ai := NewAIAnalyzer(log.Named("ai"))
	processor := NewSignalProcessor()
	leveling := NewLevelingEngine(store, log.Named("leveling"))
	engine := NewBotEngine(store, indicators, news, ai, processor, leveling, log.Named("engine"))

	return &Service{
		log:    log,
		store:  store,
		engine: engine,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			// CORS already enforced on the router — accept same origins.
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
}

// GetEngine exposes the engine for graceful shutdown.
func (s *Service) GetEngine() *BotEngine { return s.engine }

// RegisterRoutes registers /api/bots/* routes.
func (s *Service) RegisterRoutes(r chi.Router) {
	r.Route("/api/bots", func(r chi.Router) {
		r.Get("/", s.handleListBots)
		r.Post("/", s.handleCreateBot)

		r.Route("/{botID}", func(r chi.Router) {
			r.Get("/", s.handleGetBot)
			r.Put("/", s.handleUpdateBot)
			r.Delete("/", s.handleDeleteBot)

			r.Post("/start", s.handleStartBot)
			r.Post("/stop", s.handleStopBot)
			r.Post("/pause", s.handlePauseBot)
			r.Post("/resume", s.handleResumeBot)

			r.Get("/trades", s.handleGetTrades)
			r.Get("/analytics", s.handleGetAnalytics)
			r.Get("/signals", s.handleGetSignals)
			r.Get("/stream", s.handleStream)

			r.Get("/feed/{feedID}", s.handleFeedData)
			r.Post("/feed/{feedID}/toggle", s.handleFeedToggle)
		})
	})
}

// ---------- helpers ----------

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]any{"success": false, "error": msg})
}

// getUserID reads user_id from query string. In a real deployment this would
// come from an authenticated JWT claim; for the local MVP we read from query.
// Always sanitized — UUID / alphanumeric only.
func getUserID(r *http.Request) string {
	uid := r.URL.Query().Get("user_id")
	if uid == "" {
		uid = r.Header.Get("X-User-Id")
	}
	return sanitizeID(uid)
}

func sanitizeID(s string) string {
	s = strings.TrimSpace(s)
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
		if b.Len() >= 64 {
			break
		}
	}
	return b.String()
}

func validateConfig(cfg *BotConfig) error {
	// Risk profile
	switch cfg.RiskProfile {
	case "conservative", "moderate", "aggressive":
	case "":
		cfg.RiskProfile = "moderate"
	default:
		return fmt.Errorf("invalid riskProfile")
	}

	// Markets (volatility / synthetic indices)
	allowedMarkets := map[string]bool{
		"VOL100-USD": true, "VOL75-USD": true, "VOL50-USD": true, "VOL25-USD": true,
		"VOL10-USD": true, "BOOM1000-USD": true, "CRASH1000-USD": true,
	}
	cleaned := cfg.MarketSelection[:0]
	for _, m := range cfg.MarketSelection {
		if allowedMarkets[m] {
			cleaned = append(cleaned, m)
		}
	}
	cfg.MarketSelection = cleaned

	// Assets (rise/fall, FX, crypto synthetics)
	allowedAssets := map[string]bool{
		"R_10": true, "R_25": true, "R_50": true, "R_75": true, "R_100": true,
		"frxEURUSD": true, "frxGBPUSD": true, "frxUSDJPY": true,
		"cryBTCUSD": true, "cryETHUSD": true,
	}
	cleanedA := cfg.AssetSelection[:0]
	for _, a := range cfg.AssetSelection {
		if allowedAssets[a] {
			cleanedA = append(cleanedA, a)
		}
	}
	cfg.AssetSelection = cleanedA

	if len(TradingSymbols(*cfg)) == 0 {
		cfg.MarketSelection = []string{"VOL100-USD"}
	}

	// Contract types
	allowedCT := map[string]bool{"CALL": true, "PUT": true, "ACCU": true, "MULTUP": true, "MULTDOWN": true}
	cleanedCT := cfg.ContractTypes[:0]
	for _, c := range cfg.ContractTypes {
		if allowedCT[c] {
			cleanedCT = append(cleanedCT, c)
		}
	}
	cfg.ContractTypes = cleanedCT
	if len(cfg.ContractTypes) == 0 {
		cfg.ContractTypes = []string{"CALL"}
	}

	// Technical indicators
	allowedInd := map[string]bool{"rsi": true, "macd": true, "bollinger": true}
	cleanedInd := cfg.Indicators.Technical[:0]
	for _, i := range cfg.Indicators.Technical {
		if allowedInd[i] {
			cleanedInd = append(cleanedInd, i)
		}
	}
	cfg.Indicators.Technical = cleanedInd

	// News weight 0..1
	if cfg.Indicators.NewsWeight < 0 {
		cfg.Indicators.NewsWeight = 0
	}
	if cfg.Indicators.NewsWeight > 1 {
		cfg.Indicators.NewsWeight = 1
	}

	// Stake bounds
	if cfg.Execution.StakeAmount < 1 {
		cfg.Execution.StakeAmount = 10
	}
	if cfg.Execution.StakeAmount > 1000 {
		cfg.Execution.StakeAmount = 1000
	}
	if cfg.Execution.MaxDailyTrades < 1 {
		cfg.Execution.MaxDailyTrades = 20
	}
	if cfg.Execution.MaxDailyTrades > 500 {
		cfg.Execution.MaxDailyTrades = 500
	}

	// News filters: alnum + short
	filtered := cfg.NewsFilters[:0]
	for _, f := range cfg.NewsFilters {
		if len(f) > 0 && len(f) < 32 {
			filtered = append(filtered, strings.ToLower(strings.TrimSpace(f)))
		}
	}
	cfg.NewsFilters = filtered

	// Optional agent policy (paper-agent taxonomy)
	if cfg.AgentPolicy != nil {
		if err := validateAgentPolicy(cfg.AgentPolicy); err != nil {
			return err
		}
	}

	// Auto-stop / paper bankroll
	if cfg.Execution.PaperBankroll <= 0 {
		cfg.Execution.PaperBankroll = 10000
	}
	if cfg.Execution.PaperBankroll < 100 {
		cfg.Execution.PaperBankroll = 100
	}
	if cfg.Execution.PaperBankroll > 10_000_000 {
		cfg.Execution.PaperBankroll = 10_000_000
	}
	if cfg.Execution.TargetPayoutUsd < 0 {
		cfg.Execution.TargetPayoutUsd = 0
	}
	if cfg.Execution.TargetPayoutUsd > 1_000_000 {
		cfg.Execution.TargetPayoutUsd = 1_000_000
	}
	if cfg.Execution.RiskTolerancePercent < 0 {
		cfg.Execution.RiskTolerancePercent = 0
	}
	if cfg.Execution.RiskTolerancePercent > 100 {
		cfg.Execution.RiskTolerancePercent = 100
	}
	switch cfg.Execution.AutoStopMode {
	case "", AutoStopFirstHit, AutoStopTargetOnly, AutoStopRiskOnly:
	default:
		return fmt.Errorf("invalid execution.autoStopMode")
	}

	return nil
}

// ---------- handlers ----------

func (s *Service) handleListBots(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, http.StatusBadRequest, "user_id required")
		return
	}
	bots, err := s.store.ListBots(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": bots})
}

func (s *Service) handleCreateBot(w http.ResponseWriter, r *http.Request) {
	// Limit body to 32 KB to prevent resource exhaustion.
	r.Body = http.MaxBytesReader(w, r.Body, 32*1024)

	var req CreateBotRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	userID := req.UserID
	if userID == "" {
		userID = getUserID(r)
	}
	userID = sanitizeID(userID)
	if userID == "" {
		writeError(w, http.StatusBadRequest, "user_id required")
		return
	}

	name := strings.TrimSpace(req.Name)
	if len(name) < 1 || len(name) > 64 {
		writeError(w, http.StatusBadRequest, "name must be 1-64 chars")
		return
	}

	if req.ExecutionMode != ModePaper && req.ExecutionMode != ModeDemoLive {
		writeError(w, http.StatusBadRequest, "invalid execution_mode")
		return
	}

	if err := validateConfig(&req.Config); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	bot := &Bot{
		UserID:           userID,
		Name:             name,
		Status:           StatusStopped,
		ExecutionMode:    req.ExecutionMode,
		Config:           req.Config,
		Level:            1,
		XP:               0,
		UnlockedFeatures: []string{"rsi"},
	}
	if err := s.store.CreateBot(r.Context(), bot); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"success": true, "data": bot})
}

func (s *Service) handleGetBot(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	bot, err := s.store.GetBot(r.Context(), botID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": bot})
}

func (s *Service) handleUpdateBot(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 32*1024)
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")

	var req struct {
		Config BotConfig `json:"config"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if err := validateConfig(&req.Config); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if err := s.store.UpdateBotConfig(r.Context(), botID, userID, req.Config); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Service) handleDeleteBot(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	// Stop if running
	_ = s.engine.StopBot(r.Context(), botID)
	if err := s.store.DeleteBot(r.Context(), botID, userID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Service) handleStartBot(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	bot, err := s.store.GetBot(r.Context(), botID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}
	if err := s.engine.StartBot(r.Context(), bot); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "bot started"})
}

func (s *Service) handleStopBot(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	if _, err := s.store.GetBot(r.Context(), botID, userID); err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}
	if err := s.engine.StopBot(r.Context(), botID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "message": "bot stopped"})
}

func (s *Service) handlePauseBot(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	if _, err := s.store.GetBot(r.Context(), botID, userID); err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}
	if err := s.engine.PauseBot(r.Context(), botID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Service) handleResumeBot(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	if _, err := s.store.GetBot(r.Context(), botID, userID); err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}
	if err := s.engine.ResumeBot(r.Context(), botID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true})
}

func (s *Service) handleGetTrades(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}
	trades, err := s.store.ListBotTrades(r.Context(), botID, userID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": trades})
}

func (s *Service) handleGetAnalytics(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	a, err := s.store.GetBotAnalytics(r.Context(), botID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": a})
}

func (s *Service) handleGetSignals(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	limit := 100
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}
	logs, err := s.store.ListSignalLogs(r.Context(), botID, userID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": logs})
}

func (s *Service) handleStream(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	if _, err := s.store.GetBot(r.Context(), botID, userID); err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}

	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.log.Warn("ws upgrade failed", zap.Error(err))
		return
	}
	defer conn.Close()

	ch, unsub := s.engine.Subscribe(botID)
	defer unsub()

	// Initial snapshot: send analytics
	if a, err := s.store.getBotAnalyticsInternal(r.Context(), botID); err == nil {
		_ = conn.WriteJSON(EngineEvent{BotID: botID, Type: "analytics", Data: a, At: time.Now()})
	}

	// Heartbeat
	hb := time.NewTicker(25 * time.Second)
	defer hb.Stop()

	// Reader to detect client disconnect
	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			if _, _, err := conn.NextReader(); err != nil {
				return
			}
		}
	}()

	for {
		select {
		case <-done:
			return
		case <-r.Context().Done():
			return
		case ev, ok := <-ch:
			if !ok {
				return
			}
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteJSON(ev); err != nil {
				return
			}
		case <-hb.C:
			conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleFeedData returns the current state of a named feed (ticks/sentiment/patterns).
func (s *Service) handleFeedData(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	feedID := path.Base(strings.TrimSpace(chi.URLParam(r, "feedID")))

	bot, err := s.store.GetBot(r.Context(), botID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}

	feed := s.engine.GetMarketFeed()
	switch feedID {
	case "deriv_ticks":
		symbols := TradingSymbols(bot.Config)
		if len(symbols) == 0 {
			symbols = []string{"VOL100-USD", "VOL75-USD", "VOL50-USD"}
		}
		ticks := make([]MarketTick, 0, len(symbols))
		for _, sym := range symbols {
			ticks = append(ticks, feed.GetLatestTick(sym))
		}
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": map[string]any{"ticks": ticks}})
	case "sentiment":
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()
		sent := s.engine.news.GetLatestSentiment(ctx, bot.Config.NewsFilters)
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": sent})
	case "pattern":
		syms := TradingSymbols(bot.Config)
		sym := "VOL100-USD"
		if len(syms) > 0 {
			sym = syms[0]
		}
		candles := feed.GetCandles(sym, 60)
		ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
		defer cancel()
		pat := s.engine.ai.DetectPattern(ctx, candles, sym)
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": map[string]any{
			"detectedPatterns": []map[string]any{{"name": pat.Name, "confidence": pat.Confidence}},
		}})
	case "partner":
		writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": map[string]any{
			"strategies": []map[string]any{
				{"name": "Momentum Breakout", "active": bot.Level >= 4},
				{"name": "Mean Reversion", "active": bot.Level >= 3},
				{"name": "News Scalper", "active": bot.Level >= 5},
			},
		}})
	default:
		writeError(w, http.StatusBadRequest, "unknown feed")
	}
}

// handleFeedToggle persists which feeds are enabled on the bot config.
func (s *Service) handleFeedToggle(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1024)
	userID := getUserID(r)
	botID := chi.URLParam(r, "botID")
	feedID := path.Base(strings.TrimSpace(chi.URLParam(r, "feedID")))

	allowed := map[string]bool{"deriv_ticks": true, "sentiment": true, "pattern": true, "partner": true}
	if !allowed[feedID] {
		writeError(w, http.StatusBadRequest, "unknown feed")
		return
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}

	bot, err := s.store.GetBot(r.Context(), botID, userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "bot not found")
		return
	}
	if bot.Config.EnabledFeeds == nil {
		bot.Config.EnabledFeeds = map[string]bool{}
	}
	bot.Config.EnabledFeeds[feedID] = req.Enabled

	if err := s.store.UpdateBotConfig(r.Context(), botID, userID, bot.Config); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "enabled": req.Enabled})
}
