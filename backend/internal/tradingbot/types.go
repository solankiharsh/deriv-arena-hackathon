package tradingbot

import (
	"time"

	"github.com/shopspring/decimal"
)

// Bot status constants.
const (
	StatusStopped = "stopped"
	StatusRunning = "running"
	StatusPaused  = "paused"
	StatusError   = "error"
)

// Execution mode constants.
const (
	ModePaper    = "paper"
	ModeDemoLive = "demo_live"
)

// Trade side constants.
const (
	SideBuy  = "BUY"
	SideSell = "SELL"
)

// Signal log action constants.
const (
	ActionTradeExecuted    = "trade_executed"
	ActionIgnored          = "ignored"
	ActionConditionsNotMet = "conditions_not_met"
	ActionBelowThreshold   = "below_threshold"
)

// Bot is a user-owned auto-trading bot.
type Bot struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	Name             string    `json:"name"`
	Status           string    `json:"status"`
	ExecutionMode    string    `json:"execution_mode"`
	Config           BotConfig `json:"config"`
	Level            int       `json:"level"`
	XP               int       `json:"xp"`
	WinStreak        int       `json:"win_streak"`
	BestStreak       int       `json:"best_streak"`
	UnlockedFeatures []string  `json:"unlocked_features"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
	StartedAt        *time.Time `json:"started_at,omitempty"`
	StoppedAt        *time.Time `json:"stopped_at,omitempty"`
}

// BotConfig is the user-customizable config JSON.
type BotConfig struct {
	RiskProfile       string           `json:"riskProfile"`
	MarketSelection   []string         `json:"marketSelection"`
	AssetSelection    []string         `json:"assetSelection"`
	ContractTypes     []string         `json:"contractTypes"`
	Indicators        IndicatorsConfig `json:"indicators"`
	Execution         ExecutionConfig  `json:"execution"`
	NewsFilters       []string         `json:"newsFilters"`
	TimeRestrictions  TimeRestrictions `json:"timeRestrictions"`
	EnabledFeeds      map[string]bool  `json:"enabledFeeds,omitempty"`
	AgentPolicy       *BotAgentPolicy  `json:"agentPolicy,omitempty"`
}

// IndicatorsConfig defines which signal sources are active.
type IndicatorsConfig struct {
	Technical  []string `json:"technical"`
	AIPatterns bool     `json:"aiPatterns"`
	NewsWeight float64  `json:"newsWeight"`
}

// ExecutionConfig defines per-trade parameters.
type ExecutionConfig struct {
	StakeAmount            float64 `json:"stakeAmount"`
	MaxDailyTrades         int     `json:"maxDailyTrades"`
	StopLossPercent        float64 `json:"stopLossPercent"`
	TakeProfitPercent      float64 `json:"takeProfitPercent"`
	TargetPayoutUsd        float64 `json:"targetPayoutUsd"`
	RiskTolerancePercent   float64 `json:"riskTolerancePercent"`
	PaperBankroll          float64 `json:"paperBankroll"`
	AutoStopMode           string  `json:"autoStopMode"`
}

// TimeRestrictions optionally limits when a bot can trade.
type TimeRestrictions struct {
	Enabled   bool `json:"enabled"`
	StartHour int  `json:"startHour"`
	EndHour   int  `json:"endHour"`
}

// BotTrade records one executed trade.
type BotTrade struct {
	ID              string           `json:"id"`
	BotID           string           `json:"bot_id"`
	Symbol          string           `json:"symbol"`
	ContractType    string           `json:"contract_type"`
	Side            string           `json:"side"`
	Stake           decimal.Decimal  `json:"stake"`
	Payout          *decimal.Decimal `json:"payout,omitempty"`
	PnL             *decimal.Decimal `json:"pnl,omitempty"`
	EntryPrice      *decimal.Decimal `json:"entry_price,omitempty"`
	ExitPrice       *decimal.Decimal `json:"exit_price,omitempty"`
	ExecutionMode   string           `json:"execution_mode"`
	SignalSources   map[string]any   `json:"signal_sources"`
	DerivContractID *string          `json:"deriv_contract_id,omitempty"`
	XPGained        int              `json:"xp_gained"`
	ExecutedAt      time.Time        `json:"executed_at"`
	ClosedAt        *time.Time       `json:"closed_at,omitempty"`
	Metadata        map[string]any   `json:"metadata,omitempty"`
}

// BotAnalytics is aggregated performance for one bot.
type BotAnalytics struct {
	BotID          string           `json:"bot_id"`
	TotalTrades    int              `json:"total_trades"`
	WinningTrades  int              `json:"winning_trades"`
	LosingTrades   int              `json:"losing_trades"`
	TotalPnL       decimal.Decimal  `json:"total_pnl"`
	WinRate        decimal.Decimal  `json:"win_rate"`
	AvgWin         decimal.Decimal  `json:"avg_win"`
	AvgLoss        decimal.Decimal  `json:"avg_loss"`
	MaxDrawdown    decimal.Decimal  `json:"max_drawdown"`
	SharpeRatio    *decimal.Decimal `json:"sharpe_ratio,omitempty"`
	ProfitFactor   *decimal.Decimal `json:"profit_factor,omitempty"`
	LastTradeAt    *time.Time       `json:"last_trade_at,omitempty"`
	UpdatedAt      time.Time        `json:"updated_at"`
}

// BotSignalLog records an observed signal.
type BotSignalLog struct {
	ID          string         `json:"id"`
	BotID       string         `json:"bot_id"`
	SignalType  string         `json:"signal_type"`
	SignalData  map[string]any `json:"signal_data"`
	ActionTaken string         `json:"action_taken"`
	Confidence  float64        `json:"confidence"`
	CreatedAt   time.Time      `json:"created_at"`
}

// NewsItem is a single headline with derived sentiment.
type NewsItem struct {
	Title       string    `json:"title"`
	Link        string    `json:"link"`
	Description string    `json:"description"`
	PubDate     time.Time `json:"pub_date"`
	Sentiment   float64   `json:"sentiment"`
	Source      string    `json:"source"`
}

// NewsSentiment is the aggregated news signal.
type NewsSentiment struct {
	Score           float64    `json:"score"`
	ItemCount       int        `json:"item_count"`
	UpdatedAt       time.Time  `json:"updated_at"`
	RecentHeadlines []string   `json:"recent_headlines,omitempty"`
	Items           []NewsItem `json:"items,omitempty"`
}

// PatternResult is one AI-detected chart pattern.
type PatternResult struct {
	Name       string  `json:"name"`
	Confidence float64 `json:"confidence"`
	Rationale  string  `json:"rationale,omitempty"`
}

// TradeDecision is the output of the signal processor.
type TradeDecision struct {
	ShouldTrade   bool           `json:"should_trade"`
	Symbol        string         `json:"symbol"`
	ContractType  string         `json:"contract_type"`
	Side          string         `json:"side"`
	Confidence    float64        `json:"confidence"`
	SignalSources map[string]any `json:"signal_sources"`
}

// LevelUpResult describes a level-up event.
type LevelUpResult struct {
	BotID            string   `json:"bot_id"`
	OldLevel         int      `json:"old_level"`
	NewLevel         int      `json:"new_level"`
	XP               int      `json:"xp"`
	UnlockedFeatures []string `json:"unlocked_features"`
}

// CreateBotRequest is the POST /api/bots payload.
type CreateBotRequest struct {
	UserID        string    `json:"user_id"`
	Name          string    `json:"name"`
	ExecutionMode string    `json:"execution_mode"`
	Config        BotConfig `json:"config"`
}

// SimpleCandle is an internal OHLC bar used by indicators and the paper engine.
type SimpleCandle struct {
	Timestamp time.Time
	Open      float64
	High      float64
	Low       float64
	Close     float64
	Volume    float64
}

// MarketTick is an internal last-price snapshot.
type MarketTick struct {
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Change    float64   `json:"change"`
	Timestamp time.Time `json:"timestamp"`
}
