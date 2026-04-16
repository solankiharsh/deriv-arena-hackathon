package competition

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Competition represents a trading competition.
type Competition struct {
	ID              uuid.UUID       `json:"id"`
	Name            string          `json:"name"`
	PartnerID       string          `json:"partner_id,omitempty"`
	PartnerName     string          `json:"partner_name,omitempty"`
	AppID           string          `json:"app_id,omitempty"`
	DurationHours   int             `json:"duration_hours"`
	ContractTypes   []string        `json:"contract_types"`
	StartingBalance decimal.Decimal `json:"starting_balance"`
	Status          string          `json:"status"`
	StartTime       *time.Time      `json:"start_time,omitempty"`
	EndTime         *time.Time      `json:"end_time,omitempty"`
	ShareURL        string          `json:"share_url,omitempty"`
	PartnerRules    json.RawMessage `json:"partner_rules,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

const (
	StatusPending   = "pending"
	StatusActive    = "active"
	StatusEnded     = "ended"
	StatusCancelled = "cancelled"
)

const (
	ParticipantHuman = "human"
	ParticipantAgent = "agent"
)

// Participant represents a trader in a competition.
type Participant struct {
	ID              uuid.UUID       `json:"id"`
	CompetitionID   uuid.UUID       `json:"competition_id"`
	TraderID        string          `json:"trader_id"`
	TraderName      string          `json:"trader_name,omitempty"`
	DerivAccountID  string          `json:"deriv_account_id,omitempty"`
	ParticipantKind string          `json:"participant_kind"`
	Metadata        json.RawMessage `json:"metadata,omitempty"`
	JoinedAt        time.Time       `json:"joined_at"`
}

// Trade represents a single trade within a competition.
type Trade struct {
	ID            uuid.UUID        `json:"id"`
	CompetitionID uuid.UUID        `json:"competition_id"`
	ParticipantID uuid.UUID        `json:"participant_id"`
	ContractType  string           `json:"contract_type"`
	Symbol        string           `json:"symbol"`
	Stake         decimal.Decimal  `json:"stake"`
	Payout        *decimal.Decimal `json:"payout,omitempty"`
	PnL           *decimal.Decimal `json:"pnl,omitempty"`
	ExecutedAt    time.Time        `json:"executed_at"`
	ClosedAt      *time.Time       `json:"closed_at,omitempty"`
	ContractID    string           `json:"contract_id,omitempty"`
}

// Stats represents participant statistics within a competition.
type Stats struct {
	ParticipantID    uuid.UUID        `json:"participant_id"`
	TotalTrades      int              `json:"total_trades"`
	ProfitableTrades int              `json:"profitable_trades"`
	LossTrades       int              `json:"loss_trades"`
	TotalPnL         decimal.Decimal  `json:"total_pnl"`
	SortinoRatio     *decimal.Decimal `json:"sortino_ratio,omitempty"`
	MaxDrawdown      *decimal.Decimal `json:"max_drawdown,omitempty"`
	CurrentBalance   decimal.Decimal  `json:"current_balance"`
	LastUpdated      time.Time        `json:"last_updated"`
}

// LeaderboardEntry combines participant info with their stats.
type LeaderboardEntry struct {
	Participant
	Stats
	Rank int `json:"rank"`
}

// CreateCompetitionRequest is the request to create a new competition.
type CreateCompetitionRequest struct {
	Name            string          `json:"name"`
	PartnerID       string          `json:"partner_id,omitempty"`
	PartnerName     string          `json:"partner_name,omitempty"`
	AppID           string          `json:"app_id,omitempty"`
	DurationHours   int             `json:"duration_hours"`
	ContractTypes   []string        `json:"contract_types"`
	StartingBalance decimal.Decimal `json:"starting_balance"`
	PartnerRules    json.RawMessage `json:"partner_rules,omitempty"`
}

// JoinCompetitionRequest is the request to join a competition.
type JoinCompetitionRequest struct {
	CompetitionID   uuid.UUID       `json:"competition_id"`
	TraderID        string          `json:"trader_id"`
	TraderName      string          `json:"trader_name,omitempty"`
	ParticipantKind string          `json:"participant_kind,omitempty"`
	Metadata        json.RawMessage `json:"metadata,omitempty"`
}

// ConversionEvent tracks conversion nudges and outcomes.
type ConversionEvent struct {
	ID            uuid.UUID `json:"id"`
	ParticipantID uuid.UUID `json:"participant_id"`
	TriggerType   string    `json:"trigger_type"`
	NudgeShown    bool      `json:"nudge_shown"`
	Clicked       bool      `json:"clicked"`
	Converted     bool      `json:"converted"`
	CreatedAt     time.Time `json:"created_at"`
}

const (
	TriggerTop25          = "top_25"
	TriggerWinStreak      = "win_streak"
	TriggerExoticMastery  = "exotic_mastery"
	TriggerCompetitionWin = "competition_win"
)
