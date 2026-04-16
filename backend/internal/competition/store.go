package competition

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// Store handles database operations for competitions.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new competition store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// CreateCompetition creates a new competition.
func (s *Store) CreateCompetition(ctx context.Context, req CreateCompetitionRequest) (*Competition, error) {
	comp := &Competition{
		ID:              uuid.New(),
		Name:            req.Name,
		PartnerID:       req.PartnerID,
		PartnerName:     req.PartnerName,
		AppID:           req.AppID,
		DurationHours:   req.DurationHours,
		ContractTypes:   req.ContractTypes,
		StartingBalance: req.StartingBalance,
		Status:          StatusPending,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	query := `
		INSERT INTO competitions (id, name, partner_id, partner_name, app_id, duration_hours, contract_types, starting_balance, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := s.pool.Exec(ctx, query,
		comp.ID, comp.Name, comp.PartnerID, comp.PartnerName, comp.AppID,
		comp.DurationHours, comp.ContractTypes, comp.StartingBalance, comp.Status,
		comp.CreatedAt, comp.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert competition: %w", err)
	}

	return comp, nil
}

// GetCompetition retrieves a competition by ID.
func (s *Store) GetCompetition(ctx context.Context, id uuid.UUID) (*Competition, error) {
	query := `
		SELECT id, name, partner_id, partner_name, app_id, duration_hours, contract_types, starting_balance, status, start_time, end_time, share_url, created_at, updated_at
		FROM competitions
		WHERE id = $1
	`

	var comp Competition
	err := s.pool.QueryRow(ctx, query, id).Scan(
		&comp.ID, &comp.Name, &comp.PartnerID, &comp.PartnerName, &comp.AppID,
		&comp.DurationHours, &comp.ContractTypes, &comp.StartingBalance, &comp.Status,
		&comp.StartTime, &comp.EndTime, &comp.ShareURL, &comp.CreatedAt, &comp.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get competition: %w", err)
	}

	return &comp, nil
}

// ListCompetitions lists competitions with optional status filter.
func (s *Store) ListCompetitions(ctx context.Context, status string, limit int) ([]Competition, error) {
	query := `
		SELECT id, name, partner_id, partner_name, app_id, duration_hours, contract_types, starting_balance, status, start_time, end_time, share_url, created_at, updated_at
		FROM competitions
		WHERE ($1 = '' OR status = $1)
		ORDER BY created_at DESC
		LIMIT $2
	`

	rows, err := s.pool.Query(ctx, query, status, limit)
	if err != nil {
		return nil, fmt.Errorf("list competitions: %w", err)
	}
	defer rows.Close()

	var comps []Competition
	for rows.Next() {
		var comp Competition
		if err := rows.Scan(
			&comp.ID, &comp.Name, &comp.PartnerID, &comp.PartnerName, &comp.AppID,
			&comp.DurationHours, &comp.ContractTypes, &comp.StartingBalance, &comp.Status,
			&comp.StartTime, &comp.EndTime, &comp.ShareURL, &comp.CreatedAt, &comp.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan competition: %w", err)
		}
		comps = append(comps, comp)
	}

	return comps, nil
}

// StartCompetition sets a competition to active status and sets start/end times.
func (s *Store) StartCompetition(ctx context.Context, id uuid.UUID) error {
	startTime := time.Now()

	query := `
		UPDATE competitions
		SET status = $1, start_time = $2, end_time = $3, updated_at = $4
		WHERE id = $5 AND status = $6
	`

	var endTime time.Time
	// Get duration first
	var durationHours int
	err := s.pool.QueryRow(ctx, "SELECT duration_hours FROM competitions WHERE id = $1", id).Scan(&durationHours)
	if err != nil {
		return fmt.Errorf("get duration: %w", err)
	}

	endTime = startTime.Add(time.Duration(durationHours) * time.Hour)

	result, err := s.pool.Exec(ctx, query, StatusActive, startTime, endTime, time.Now(), id, StatusPending)
	if err != nil {
		return fmt.Errorf("start competition: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("competition not found or already started")
	}

	return nil
}

// EndCompetition sets a competition to ended status.
func (s *Store) EndCompetition(ctx context.Context, id uuid.UUID) error {
	query := `
		UPDATE competitions
		SET status = $1, updated_at = $2
		WHERE id = $3 AND status = $4
	`

	result, err := s.pool.Exec(ctx, query, StatusEnded, time.Now(), id, StatusActive)
	if err != nil {
		return fmt.Errorf("end competition: %w", err)
	}

	if result.RowsAffected() == 0 {
		return fmt.Errorf("competition not found or not active")
	}

	return nil
}

// JoinCompetition adds a participant to a competition.
func (s *Store) JoinCompetition(ctx context.Context, req JoinCompetitionRequest) (*Participant, error) {
	kind := strings.TrimSpace(strings.ToLower(req.ParticipantKind))
	if kind == "" {
		kind = ParticipantHuman
	}
	if kind != ParticipantHuman && kind != ParticipantAgent {
		return nil, fmt.Errorf("participant_kind must be %q or %q", ParticipantHuman, ParticipantAgent)
	}

	meta := req.Metadata
	if len(meta) == 0 {
		meta = json.RawMessage(`{}`)
	}
	if len(meta) > 8192 {
		return nil, fmt.Errorf("metadata exceeds 8192 bytes")
	}
	if !json.Valid(meta) {
		return nil, fmt.Errorf("metadata must be valid JSON")
	}

	participant := &Participant{
		ID:              uuid.New(),
		CompetitionID:   req.CompetitionID,
		TraderID:        req.TraderID,
		TraderName:      req.TraderName,
		ParticipantKind: kind,
		Metadata:        meta,
		JoinedAt:        time.Now(),
	}

	query := `
		INSERT INTO participants (id, competition_id, trader_id, trader_name, participant_kind, metadata, joined_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (competition_id, trader_id) DO NOTHING
		RETURNING id, participant_kind, metadata
	`

	err := s.pool.QueryRow(ctx, query,
		participant.ID, participant.CompetitionID, participant.TraderID, participant.TraderName,
		participant.ParticipantKind, participant.Metadata, participant.JoinedAt,
	).Scan(&participant.ID, &participant.ParticipantKind, &participant.Metadata)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return s.getParticipantByCompetitionAndTrader(ctx, req.CompetitionID, req.TraderID)
		}
		return nil, fmt.Errorf("join competition: %w", err)
	}

	// Initialize stats
	var startingBalance decimal.Decimal
	err = s.pool.QueryRow(ctx, "SELECT starting_balance FROM competitions WHERE id = $1", req.CompetitionID).Scan(&startingBalance)
	if err != nil {
		return nil, fmt.Errorf("get starting balance: %w", err)
	}

	statsQuery := `
		INSERT INTO competition_stats (participant_id, current_balance, last_updated)
		VALUES ($1, $2, $3)
		ON CONFLICT (participant_id) DO NOTHING
	`
	_, err = s.pool.Exec(ctx, statsQuery, participant.ID, startingBalance, time.Now())
	if err != nil {
		return nil, fmt.Errorf("init stats: %w", err)
	}

	return participant, nil
}

// GetParticipant retrieves a participant by ID.
func (s *Store) GetParticipant(ctx context.Context, id uuid.UUID) (*Participant, error) {
	query := `
		SELECT id, competition_id, trader_id, trader_name, deriv_account_id, participant_kind, metadata, joined_at
		FROM participants
		WHERE id = $1
	`

	var p Participant
	err := s.pool.QueryRow(ctx, query, id).Scan(
		&p.ID, &p.CompetitionID, &p.TraderID, &p.TraderName, &p.DerivAccountID, &p.ParticipantKind, &p.Metadata, &p.JoinedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get participant: %w", err)
	}

	return &p, nil
}

func (s *Store) getParticipantByCompetitionAndTrader(ctx context.Context, competitionID uuid.UUID, traderID string) (*Participant, error) {
	query := `
		SELECT id, competition_id, trader_id, trader_name, deriv_account_id, participant_kind, metadata, joined_at
		FROM participants
		WHERE competition_id = $1 AND trader_id = $2
	`
	var p Participant
	err := s.pool.QueryRow(ctx, query, competitionID, traderID).Scan(
		&p.ID, &p.CompetitionID, &p.TraderID, &p.TraderName, &p.DerivAccountID, &p.ParticipantKind, &p.Metadata, &p.JoinedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("participant already joined or missing: %w", err)
	}
	return &p, nil
}

// ListParticipants lists all participants in a competition.
func (s *Store) ListParticipants(ctx context.Context, competitionID uuid.UUID) ([]Participant, error) {
	query := `
		SELECT id, competition_id, trader_id, trader_name, deriv_account_id, participant_kind, metadata, joined_at
		FROM participants
		WHERE competition_id = $1
		ORDER BY joined_at ASC
	`

	rows, err := s.pool.Query(ctx, query, competitionID)
	if err != nil {
		return nil, fmt.Errorf("list participants: %w", err)
	}
	defer rows.Close()

	var participants []Participant
	for rows.Next() {
		var p Participant
		if err := rows.Scan(&p.ID, &p.CompetitionID, &p.TraderID, &p.TraderName, &p.DerivAccountID, &p.ParticipantKind, &p.Metadata, &p.JoinedAt); err != nil {
			return nil, fmt.Errorf("scan participant: %w", err)
		}
		participants = append(participants, p)
	}

	return participants, nil
}

// RecordTrade records a trade for a participant.
func (s *Store) RecordTrade(ctx context.Context, trade Trade) error {
	query := `
		INSERT INTO competition_trades (id, competition_id, participant_id, contract_type, symbol, stake, payout, pnl, executed_at, closed_at, contract_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`

	_, err := s.pool.Exec(ctx, query,
		trade.ID, trade.CompetitionID, trade.ParticipantID, trade.ContractType, trade.Symbol,
		trade.Stake, trade.Payout, trade.PnL, trade.ExecutedAt, trade.ClosedAt, trade.ContractID,
	)
	if err != nil {
		return fmt.Errorf("record trade: %w", err)
	}

	// Update stats
	if trade.PnL != nil {
		if err := s.updateStats(ctx, trade.ParticipantID); err != nil {
			return fmt.Errorf("update stats: %w", err)
		}
	}

	return nil
}

// updateStats recalculates statistics for a participant.
func (s *Store) updateStats(ctx context.Context, participantID uuid.UUID) error {
	query := `
		WITH trade_stats AS (
			SELECT
				participant_id,
				COUNT(*) as total_trades,
				COUNT(*) FILTER (WHERE pnl > 0) as profitable_trades,
				COALESCE(SUM(pnl), 0) as total_pnl
			FROM competition_trades
			WHERE participant_id = $1 AND pnl IS NOT NULL
			GROUP BY participant_id
		),
		starting_balance AS (
			SELECT c.starting_balance
			FROM participants p
			JOIN competitions c ON p.competition_id = c.id
			WHERE p.id = $1
		)
		UPDATE competition_stats cs
		SET
			total_trades = COALESCE(ts.total_trades, 0),
			profitable_trades = COALESCE(ts.profitable_trades, 0),
			total_pnl = COALESCE(ts.total_pnl, 0),
			current_balance = sb.starting_balance + COALESCE(ts.total_pnl, 0),
			last_updated = NOW()
		FROM trade_stats ts, starting_balance sb
		WHERE cs.participant_id = $1
	`

	_, err := s.pool.Exec(ctx, query, participantID)
	return err
}

// GetLeaderboard retrieves the competition leaderboard sorted by Sortino ratio.
func (s *Store) GetLeaderboard(ctx context.Context, competitionID uuid.UUID) ([]LeaderboardEntry, error) {
	query := `
		SELECT
			p.id, p.competition_id, p.trader_id, p.trader_name, p.deriv_account_id, p.participant_kind, p.metadata, p.joined_at,
			(SELECT COUNT(*)::int FROM competition_trades t WHERE t.participant_id = p.id AND t.pnl IS NOT NULL AND t.pnl < 0) AS loss_trades,
			s.participant_id, s.total_trades, s.profitable_trades, s.total_pnl, s.sortino_ratio, s.max_drawdown, s.current_balance, s.last_updated,
			ROW_NUMBER() OVER (ORDER BY s.sortino_ratio DESC NULLS LAST, s.total_pnl DESC) as rank
		FROM participants p
		JOIN competition_stats s ON p.id = s.participant_id
		WHERE p.competition_id = $1
		ORDER BY rank ASC
	`

	rows, err := s.pool.Query(ctx, query, competitionID)
	if err != nil {
		return nil, fmt.Errorf("get leaderboard: %w", err)
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	for rows.Next() {
		var entry LeaderboardEntry
		if err := rows.Scan(
			&entry.ID, &entry.CompetitionID, &entry.TraderID, &entry.TraderName, &entry.DerivAccountID, &entry.ParticipantKind, &entry.Metadata, &entry.JoinedAt,
			&entry.Stats.LossTrades,
			&entry.Stats.ParticipantID, &entry.Stats.TotalTrades, &entry.Stats.ProfitableTrades, &entry.Stats.TotalPnL,
			&entry.Stats.SortinoRatio, &entry.Stats.MaxDrawdown, &entry.Stats.CurrentBalance, &entry.Stats.LastUpdated,
			&entry.Rank,
		); err != nil {
			return nil, fmt.Errorf("scan leaderboard entry: %w", err)
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

// RecordConversionEvent records a conversion nudge event.
func (s *Store) RecordConversionEvent(ctx context.Context, event ConversionEvent) error {
	query := `
		INSERT INTO conversion_events (id, participant_id, trigger_type, nudge_shown, clicked, converted, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := s.pool.Exec(ctx, query,
		event.ID, event.ParticipantID, event.TriggerType, event.NudgeShown, event.Clicked, event.Converted, event.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("record conversion event: %w", err)
	}

	return nil
}
