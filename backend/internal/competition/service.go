package competition

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// Service handles competition HTTP endpoints.
type Service struct {
	log          *zap.Logger
	store        *Store
	shareBaseURL string // base URL of the Next.js frontend (for share links)
}

// NewService creates a new competition service.
// shareBaseURL should point at the Next.js app (e.g. http://localhost:3000),
// not the API server, so that share links open the join page correctly.
func NewService(log *zap.Logger, pool *pgxpool.Pool, shareBaseURL string) *Service {
	return &Service{
		log:          log,
		store:        NewStore(pool),
		shareBaseURL: shareBaseURL,
	}
}

// RegisterRoutes registers HTTP handlers on the given router.
func (s *Service) RegisterRoutes(r chi.Router) {
	r.Route("/api/competitions", func(r chi.Router) {
		r.Post("/", s.handleCreate)
		r.Get("/", s.handleList)
		r.Get("/{id}", s.handleGet)
		r.Post("/{id}/start", s.handleStart)
		r.Post("/{id}/end", s.handleEnd)
		r.Post("/{id}/join", s.handleJoin)
		r.Post("/{id}/trade", s.handleRecordTrade)
		r.Get("/{id}/participants", s.handleListParticipants)
		r.Get("/{id}/leaderboard", s.handleLeaderboard)
		r.Get("/{id}/leaderboard/stream", s.handleLeaderboardStream)
		r.Post("/{id}/recalculate", s.handleRecalculateSortino)
	})
}

func (s *Service) handleCreate(w http.ResponseWriter, r *http.Request) {
	var req CreateCompetitionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("decode request: %v", err), http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "name required", http.StatusBadRequest)
		return
	}
	if req.DurationHours <= 0 {
		http.Error(w, "duration_hours must be positive", http.StatusBadRequest)
		return
	}
	if req.StartingBalance.IsZero() || req.StartingBalance.IsNegative() {
		http.Error(w, "starting_balance must be positive", http.StatusBadRequest)
		return
	}

	normalizedRules, err := ValidatePartnerRulesJSON(req.PartnerRules)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	req.PartnerRules = normalizedRules

	comp, err := s.store.CreateCompetition(r.Context(), req)
	if err != nil {
		s.log.Error("Failed to create competition", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Generate share URL pointing at the Next.js join page
	comp.ShareURL = fmt.Sprintf("%s/join/%s", strings.TrimRight(s.shareBaseURL, "/"), comp.ID.String())
	
	// Update with share URL
	updateQuery := "UPDATE competitions SET share_url = $1 WHERE id = $2"
	_, err = s.store.pool.Exec(r.Context(), updateQuery, comp.ShareURL, comp.ID)
	if err != nil {
		s.log.Warn("Failed to update share_url", zap.Error(err))
	}

	s.log.Info("Competition created",
		zap.String("id", comp.ID.String()),
		zap.String("name", comp.Name),
		zap.String("partner_id", comp.PartnerID),
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comp)
}

func (s *Service) handleList(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	limit := 50
	
	comps, err := s.store.ListCompetitions(r.Context(), status, limit)
	if err != nil {
		s.log.Error("Failed to list competitions", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comps)
}

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	comp, err := s.store.GetCompetition(r.Context(), id)
	if err != nil {
		s.log.Error("Failed to get competition", zap.Error(err), zap.String("id", idStr))
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comp)
}

func (s *Service) handleStart(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	if err := s.store.StartCompetition(r.Context(), id); err != nil {
		s.log.Error("Failed to start competition", zap.Error(err), zap.String("id", idStr))
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.log.Info("Competition started", zap.String("id", idStr))

	comp, _ := s.store.GetCompetition(r.Context(), id)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comp)
}

func (s *Service) handleEnd(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	if err := s.store.EndCompetition(r.Context(), id); err != nil {
		s.log.Error("Failed to end competition", zap.Error(err), zap.String("id", idStr))
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	s.log.Info("Competition ended", zap.String("id", idStr))

	comp, _ := s.store.GetCompetition(r.Context(), id)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comp)
}

func (s *Service) handleJoin(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	compID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var req struct {
		TraderID          string          `json:"trader_id"`
		TraderName        string          `json:"trader_name"`
		ParticipantKind   string          `json:"participant_kind"`
		Metadata          json.RawMessage `json:"metadata"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("decode request: %v", err), http.StatusBadRequest)
		return
	}

	if req.TraderID == "" {
		http.Error(w, "trader_id required", http.StatusBadRequest)
		return
	}
	if len(req.Metadata) > 8192 {
		http.Error(w, "metadata too large", http.StatusBadRequest)
		return
	}
	if len(req.Metadata) > 0 && !json.Valid(req.Metadata) {
		http.Error(w, "metadata must be valid JSON", http.StatusBadRequest)
		return
	}

	participant, err := s.store.JoinCompetition(r.Context(), JoinCompetitionRequest{
		CompetitionID:   compID,
		TraderID:        req.TraderID,
		TraderName:      req.TraderName,
		ParticipantKind: req.ParticipantKind,
		Metadata:        req.Metadata,
	})
	if err != nil {
		s.log.Error("Failed to join competition", zap.Error(err), zap.String("competition_id", idStr), zap.String("trader_id", req.TraderID))
		http.Error(w, "failed to join", http.StatusBadRequest)
		return
	}

	s.log.Info("Trader joined competition",
		zap.String("competition_id", idStr),
		zap.String("participant_id", participant.ID.String()),
		zap.String("trader_id", req.TraderID),
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(participant)
}

// handleRecordTrade records a closed trade for a participant identified by trader_id (same as join flow).
// Demo / integration hook until Deriv fills are wired; requires competition status active.
func (s *Service) handleRecordTrade(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	idStr := chi.URLParam(r, "id")
	compID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body struct {
		TraderID     string  `json:"trader_id"`
		ContractType string  `json:"contract_type"`
		Symbol       string  `json:"symbol"`
		Stake        string  `json:"stake"`
		Payout       *string `json:"payout"`
		PnL          *string `json:"pnl"`
		ContractID   string  `json:"contract_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, fmt.Sprintf("decode request: %v", err), http.StatusBadRequest)
		return
	}

	body.TraderID = strings.TrimSpace(body.TraderID)
	body.ContractType = strings.TrimSpace(body.ContractType)
	body.Symbol = strings.TrimSpace(body.Symbol)
	body.ContractID = strings.TrimSpace(body.ContractID)

	if body.TraderID == "" {
		http.Error(w, "trader_id required", http.StatusBadRequest)
		return
	}
	if body.ContractType == "" || body.Symbol == "" {
		http.Error(w, "contract_type and symbol required", http.StatusBadRequest)
		return
	}
	if body.PnL == nil || strings.TrimSpace(*body.PnL) == "" {
		http.Error(w, "pnl required (closed trade) for leaderboard stats", http.StatusBadRequest)
		return
	}

	comp, err := s.store.GetCompetition(r.Context(), compID)
	if err != nil {
		s.log.Error("record trade: get competition", zap.Error(err))
		http.Error(w, "competition not found", http.StatusNotFound)
		return
	}
	if comp.Status != StatusActive {
		http.Error(w, "trades only accepted while competition is active", http.StatusBadRequest)
		return
	}

	allowed := false
	for _, ct := range comp.ContractTypes {
		if strings.EqualFold(strings.TrimSpace(ct), body.ContractType) {
			allowed = true
			break
		}
	}
	if !allowed {
		http.Error(w, "contract_type not allowed for this competition", http.StatusBadRequest)
		return
	}

	stake, err := decimal.NewFromString(strings.TrimSpace(body.Stake))
	if err != nil || !stake.IsPositive() {
		http.Error(w, "stake must be a positive decimal", http.StatusBadRequest)
		return
	}

	rules := ParsePartnerRules(comp.PartnerRules)
	if rules.MaxStakePerContract != nil && stake.GreaterThan(*rules.MaxStakePerContract) {
		http.Error(w, "stake exceeds competition partner_rules.max_stake_per_contract", http.StatusBadRequest)
		return
	}

	pnl, err := decimal.NewFromString(strings.TrimSpace(*body.PnL))
	if err != nil {
		http.Error(w, "invalid pnl", http.StatusBadRequest)
		return
	}

	var payout *decimal.Decimal
	if body.Payout != nil && strings.TrimSpace(*body.Payout) != "" {
		p, err := decimal.NewFromString(strings.TrimSpace(*body.Payout))
		if err != nil {
			http.Error(w, "invalid payout", http.StatusBadRequest)
			return
		}
		payout = &p
	}

	participant, err := s.store.getParticipantByCompetitionAndTrader(r.Context(), compID, body.TraderID)
	if err != nil {
		http.Error(w, "participant not found — join this competition first", http.StatusBadRequest)
		return
	}

	if rules.MaxLossPerDay != nil && pnl.IsNegative() {
		spent, err := s.store.SumAbsLossesTodayUTC(r.Context(), participant.ID)
		if err != nil {
			s.log.Error("record trade: sum losses today", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if spent.Add(pnl.Abs()).GreaterThan(*rules.MaxLossPerDay) {
			http.Error(w, "trade would exceed partner_rules.max_loss_per_day", http.StatusBadRequest)
			return
		}
	}

	if rules.MaxDrawdownPercent != nil {
		dd, err := s.store.MaxDrawdownPercentAfterIncludingPnL(r.Context(), participant.ID, pnl)
		if err != nil {
			s.log.Error("record trade: max drawdown check", zap.Error(err))
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if dd.GreaterThan(*rules.MaxDrawdownPercent) {
			http.Error(w, "trade would exceed partner_rules.max_drawdown_percent", http.StatusBadRequest)
			return
		}
	}

	tr := Trade{
		ID:            uuid.New(),
		CompetitionID: compID,
		ParticipantID: participant.ID,
		ContractType:  body.ContractType,
		Symbol:        body.Symbol,
		Stake:         stake,
		Payout:        payout,
		PnL:           &pnl,
		ExecutedAt:    time.Now(),
		ClosedAt:      ptrTime(time.Now()),
		ContractID:    body.ContractID,
	}

	if err := s.store.RecordTrade(r.Context(), tr); err != nil {
		s.log.Error("record trade failed", zap.Error(err))
		http.Error(w, "could not record trade", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tr)
}

func ptrTime(t time.Time) *time.Time {
	return &t
}

func (s *Service) handleListParticipants(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	participants, err := s.store.ListParticipants(r.Context(), id)
	if err != nil {
		s.log.Error("Failed to list participants", zap.Error(err), zap.String("id", idStr))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(participants)
}

func (s *Service) handleLeaderboard(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	leaderboard, err := s.store.GetLeaderboard(r.Context(), id)
	if err != nil {
		s.log.Error("Failed to get leaderboard", zap.Error(err), zap.String("id", idStr))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(leaderboard)
}

// handleLeaderboardStream provides Server-Sent Events stream for live leaderboard updates.
func (s *Service) handleLeaderboardStream(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	ctx := r.Context()
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	// Send initial data
	leaderboard, err := s.store.GetLeaderboard(ctx, id)
	if err == nil {
		data, _ := json.Marshal(leaderboard)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			leaderboard, err := s.store.GetLeaderboard(ctx, id)
			if err != nil {
				s.log.Error("Failed to fetch leaderboard for stream", zap.Error(err))
				continue
			}

			data, err := json.Marshal(leaderboard)
			if err != nil {
				continue
			}

			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}
}

func (s *Service) handleRecalculateSortino(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}

	if err := s.store.RecalculateAllSortino(r.Context(), id); err != nil {
		s.log.Error("Failed to recalculate Sortino", zap.Error(err), zap.String("id", idStr))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	s.log.Info("Recalculated Sortino ratios", zap.String("id", idStr))

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// StartAutoEndTask starts a background task that ends competitions when they expire.
func (s *Service) StartAutoEndTask(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := s.endExpiredCompetitions(ctx); err != nil {
				s.log.Error("Failed to end expired competitions", zap.Error(err))
			}
		}
	}
}

func (s *Service) endExpiredCompetitions(ctx context.Context) error {
	query := `
		SELECT id FROM competitions
		WHERE status = $1 AND end_time <= $2
	`

	rows, err := s.store.pool.Query(ctx, query, StatusActive, time.Now())
	if err != nil {
		return fmt.Errorf("query expired: %w", err)
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return fmt.Errorf("scan id: %w", err)
		}
		ids = append(ids, id)
	}

	for _, id := range ids {
		if err := s.store.EndCompetition(ctx, id); err != nil {
			s.log.Error("Failed to auto-end competition", zap.Error(err), zap.String("id", id.String()))
		} else {
			s.log.Info("Auto-ended competition", zap.String("id", id.String()))
		}
	}

	return nil
}
