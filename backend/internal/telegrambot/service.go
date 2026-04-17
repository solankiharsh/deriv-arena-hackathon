package telegrambot

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"
)

// Config holds runtime configuration, all read from environment.
type Config struct {
	Enabled       bool
	DryRun        bool
	BotToken      string
	ChatID        string
	MaxPerHour    int
	AdminAPIKey   string
	OGBaseURL     string
	FrontendURL   string
	BigWinMinPnL  float64
}

// ConfigFromEnv populates Config from os.Getenv only; secrets never logged.
func ConfigFromEnv() Config {
	cfg := Config{
		BotToken:     os.Getenv("TELEGRAM_BOT_TOKEN"),
		ChatID:       os.Getenv("TELEGRAM_CHAT_ID"),
		AdminAPIKey:  os.Getenv("ADMIN_API_KEY"),
		OGBaseURL:    firstNonEmpty(os.Getenv("OG_BASE_URL"), os.Getenv("FRONTEND_BASE_URL")),
		FrontendURL:  firstNonEmpty(os.Getenv("FRONTEND_BASE_URL"), "https://frontend-preethi-3498s-projects.vercel.app"),
		BigWinMinPnL: 100,
	}
	cfg.Enabled = parseBool(os.Getenv("TELEGRAM_ENABLED"))
	cfg.DryRun = parseBool(os.Getenv("TELEGRAM_DRY_RUN"))
	if v := os.Getenv("TELEGRAM_MAX_POSTS_PER_HOUR"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			cfg.MaxPerHour = n
		}
	}
	if cfg.MaxPerHour == 0 {
		cfg.MaxPerHour = 8
	}
	if v := os.Getenv("TELEGRAM_BIG_WIN_MIN_PNL"); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil && n > 0 {
			cfg.BigWinMinPnL = n
		}
	}
	return cfg
}

func parseBool(s string) bool {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

// Service ties together client, broadcaster, store, queries, poller, scheduler,
// and HTTP routes.
type Service struct {
	log       *zap.Logger
	cfg       Config
	store     *Store
	queries   *Queries
	client    *Client
	broadcast *Broadcaster
	poller    *Poller
	scheduler *Scheduler
	confirms  *confirmStore
	rl        *tokenBucket

	cancel context.CancelFunc
	done   chan struct{}
}

// NewService builds a service. If Enabled is false, this is a no-op service
// that still registers admin routes so an operator can test preview flow.
func NewService(log *zap.Logger, pool *pgxpool.Pool, cfg Config) *Service {
	if log == nil {
		log = zap.NewNop()
	}
	store := NewStore(pool)
	queries := NewQueries(pool)
	client := NewClient(cfg.BotToken, log.Named("client"), cfg.DryRun || !cfg.Enabled)
	b := NewBroadcaster(log.Named("broadcast"), client, store, BroadcasterConfig{
		ChatID:        cfg.ChatID,
		MaxPostsPerHr: cfg.MaxPerHour,
	})
	poller := NewPoller(log.Named("poller"), queries, store, b, cfg.OGBaseURL, cfg.FrontendURL, cfg.BigWinMinPnL)
	scheduler := NewScheduler(log.Named("scheduler"), queries, b, cfg.OGBaseURL, cfg.FrontendURL)
	return &Service{
		log:       log,
		cfg:       cfg,
		store:     store,
		queries:   queries,
		client:    client,
		broadcast: b,
		poller:    poller,
		scheduler: scheduler,
		confirms:  newConfirmStore(),
		rl:        newTokenBucket(5, 5),
		done:      make(chan struct{}),
	}
}

// Start launches background loops. If disabled, only HTTP routes remain available.
func (s *Service) Start(parent context.Context) {
	if !s.cfg.Enabled {
		s.log.Info("telegrambot disabled (TELEGRAM_ENABLED!=true); admin endpoints still mounted")
		close(s.done)
		return
	}
	if s.cfg.BotToken == "" && !s.cfg.DryRun {
		s.log.Warn("TELEGRAM_BOT_TOKEN unset and DryRun=false; forcing dry-run")
		s.cfg.DryRun = true
	}
	ctx, cancel := context.WithCancel(parent)
	s.cancel = cancel
	go func() {
		defer close(s.done)
		s.scheduler.Start(ctx)
		go s.poller.Run(ctx)
		if parseBool(os.Getenv("TELEGRAM_STARTUP_PING")) {
			go s.enqueueStartupPing()
		}
		s.broadcast.Run(ctx)
		s.scheduler.Stop(context.Background())
	}()
	s.log.Info("telegrambot started",
		zap.Bool("dry_run", s.cfg.DryRun),
		zap.String("chat_id", s.cfg.ChatID),
		zap.Int("max_per_hour", s.cfg.MaxPerHour),
	)
}

// Stop cancels the context and waits up to 30s for the broadcaster to drain.
func (s *Service) Stop(ctx context.Context) {
	if s.cancel != nil {
		s.cancel()
	}
	select {
	case <-s.done:
	case <-time.After(30 * time.Second):
		s.log.Warn("telegrambot stop drain timeout")
	case <-ctx.Done():
	}
}

// RegisterRoutes mounts /api/admin/telegram/*.
func (s *Service) RegisterRoutes(r chi.Router) {
	r.Route("/api/admin/telegram", func(r chi.Router) {
		r.Use(AdminAuth(s.cfg.AdminAPIKey))
		r.Post("/announce", s.handleAnnouncePreview)
		r.Post("/confirm", s.handleAnnounceConfirm)
		r.Delete("/message/{id}", s.handleDeleteMessage)
		r.Get("/health", s.handleHealth)
	})
}

// ---- admin handlers ----

type announceRequest struct {
	Title   string `json:"title"`
	Body    string `json:"body"`
	LinkURL string `json:"link_url"`
	// Optional image URL; must be under OGBaseURL.
	ImageURL string `json:"image_url"`
}

type announcePreviewResponse struct {
	Preview      string `json:"preview"`
	ImageURL     string `json:"image_url,omitempty"`
	ConfirmToken string `json:"confirm_token"`
	PayloadHash  string `json:"payload_hash"`
	Expires      string `json:"expires"`
}

type announceConfirmRequest struct {
	ConfirmToken string `json:"confirm_token"`
	PayloadHash  string `json:"payload_hash"`
}

// handleAnnouncePreview validates input, renders, returns a preview + token.
func (s *Service) handleAnnouncePreview(w http.ResponseWriter, r *http.Request) {
	if !s.rl.allow("admin:announce:" + clientIP(r)) {
		writeJSONErr(w, http.StatusTooManyRequests, "rate limited")
		return
	}
	var req announceRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8<<10)).Decode(&req); err != nil {
		writeJSONErr(w, http.StatusBadRequest, "bad json")
		return
	}
	if len(req.Title) > 120 || len(req.Body) > 1000 {
		writeJSONErr(w, http.StatusBadRequest, "title/body too long")
		return
	}
	title := safeTitle(req.Title)
	body := safeBody(req.Body)
	if title == "" && body == "" {
		writeJSONErr(w, http.StatusBadRequest, "title or body required")
		return
	}
	link := safeURL(strings.TrimSpace(req.LinkURL))
	image := ""
	if req.ImageURL != "" {
		// Image must be on our OG base to prevent leaking arbitrary URLs into channel.
		ogAllowed := strings.TrimRight(s.cfg.OGBaseURL, "/")
		if ogAllowed != "" && strings.HasPrefix(req.ImageURL, ogAllowed+"/api/og/") {
			image = req.ImageURL
		}
	}
	text := renderAdminAnnounce(req.Title, req.Body)
	buttons := [][]InlineButton{}
	if link != "" {
		buttons = append(buttons, []InlineButton{{Text: "Learn more", URL: link}})
	}
	payload := map[string]any{
		"title":    title,
		"body":     body,
		"link":     link,
		"image":    image,
		"issued":   time.Now().UTC().Format(time.RFC3339),
	}
	post := Post{
		Kind:      PillarAdminAnnounce,
		DedupeKey: dedupeKey(PillarAdminAnnounce, payload),
		Text:      text,
		ImageURL:  image,
		Buttons:   buttons,
		Payload:   payload,
	}
	token, err := s.confirms.put(post, post.DedupeKey, 5*time.Minute)
	if err != nil {
		writeJSONErr(w, http.StatusInternalServerError, "token gen failed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(announcePreviewResponse{
		Preview:      text,
		ImageURL:     image,
		ConfirmToken: token,
		PayloadHash:  post.DedupeKey,
		Expires:      time.Now().UTC().Add(5 * time.Minute).Format(time.RFC3339),
	})
}

// handleAnnounceConfirm consumes a token and enqueues the post.
func (s *Service) handleAnnounceConfirm(w http.ResponseWriter, r *http.Request) {
	if !s.rl.allow("admin:confirm:" + clientIP(r)) {
		writeJSONErr(w, http.StatusTooManyRequests, "rate limited")
		return
	}
	var req announceConfirmRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4<<10)).Decode(&req); err != nil {
		writeJSONErr(w, http.StatusBadRequest, "bad json")
		return
	}
	if req.ConfirmToken == "" || req.PayloadHash == "" {
		writeJSONErr(w, http.StatusBadRequest, "missing fields")
		return
	}
	post, ok := s.confirms.take(req.ConfirmToken, req.PayloadHash)
	if !ok {
		writeJSONErr(w, http.StatusBadRequest, "invalid or expired token")
		return
	}
	s.broadcast.Enqueue(post)
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"queued": true, "kind": post.Kind})
}

// handleDeleteMessage lets an admin take down a post by id (broadcasts.id or dedupe_key).
func (s *Service) handleDeleteMessage(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if len(id) == 0 || len(id) > 128 {
		writeJSONErr(w, http.StatusBadRequest, "invalid id")
		return
	}
	mid, err := s.store.GetMessageID(r.Context(), id)
	if err != nil {
		writeJSONErr(w, http.StatusNotFound, "not found")
		return
	}
	if err := s.client.DeleteMessage(r.Context(), s.cfg.ChatID, mid); err != nil {
		writeJSONErr(w, http.StatusBadGateway, "delete failed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"deleted": true, "message_id": mid})
}

// handleHealth exposes basic status (no secrets).
func (s *Service) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"enabled":      s.cfg.Enabled,
		"dry_run":      s.cfg.DryRun,
		"chat_id":      s.cfg.ChatID,
		"max_per_hour": s.cfg.MaxPerHour,
	})
}

// enqueueStartupPing fires a one-off post on boot so an operator can verify
// the pipeline end-to-end. Dedupe key is bucketed per hour so restarts don't
// spam: only the first ping per hour lands.
func (s *Service) enqueueStartupPing() {
	now := time.Now().UTC()
	bucket := now.Format("2006-01-02T15")
	payload := map[string]any{
		"kind":   "startup_ping",
		"bucket": bucket,
	}
	text := renderAdminAnnounce(
		"Deriv Arena bot online",
		"This is a one-off startup heartbeat. Live leaderboards, competitions, Miles drops, and bot-board updates will follow automatically.",
	)
	s.broadcast.Enqueue(Post{
		Kind:      PillarAdminAnnounce,
		DedupeKey: dedupeKey(PillarAdminAnnounce, payload),
		Text:      text,
		Buttons: [][]InlineButton{{
			{Text: "Open Arena", URL: s.cfg.FrontendURL + "/arena"},
		}},
		Payload: payload,
	})
}

// clientIP is a best-effort IP extractor for rate-limit keying. Never logged.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.IndexByte(xff, ','); i > 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	if r.RemoteAddr != "" {
		if i := strings.LastIndexByte(r.RemoteAddr, ':'); i > 0 {
			return r.RemoteAddr[:i]
		}
		return r.RemoteAddr
	}
	return "unknown"
}
