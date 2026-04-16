package derivmiles

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// Tier constants
const (
	TierBronze   = "bronze"
	TierSilver   = "silver"
	TierGold     = "gold"
	TierPlatinum = "platinum"
)

// Transaction types
const (
	TransactionTypeEarn   = "earn"
	TransactionTypeSpend  = "spend"
	TransactionTypeExpire = "expire"
	TransactionTypeRefund = "refund"
)

// Source types
const (
	SourceTypeXP              = "xp"
	SourceTypeProfitableTrade = "profitable_trade"
	SourceTypeCompetitionWin  = "competition_win"
	SourceTypeWinStreak       = "win_streak"
	SourceTypeDailyLogin      = "daily_login"
	SourceTypeReferral        = "referral"
	SourceTypeManual          = "manual"
	SourceTypeRedemption      = "redemption"
)

// Category types
const (
	CategoryAIAnalysis      = "ai_analysis"
	CategoryPremiumFeature  = "premium_feature"
	CategoryThirdPartyTool  = "third_party_tool"
	CategoryMarketplaceItem = "marketplace_item"
	CategoryTradingBenefit  = "trading_benefit"
)

// Redemption status
const (
	RedemptionStatusPending   = "pending"
	RedemptionStatusFulfilled = "fulfilled"
	RedemptionStatusFailed    = "failed"
	RedemptionStatusRefunded  = "refunded"
)

// Balance represents a user's miles balance and tier
type Balance struct {
	UserID       string          `json:"user_id"`
	TotalEarned  decimal.Decimal `json:"total_earned"`
	CurrentBalance decimal.Decimal `json:"current_balance"`
	TotalSpent   decimal.Decimal `json:"total_spent"`
	Tier         string          `json:"tier"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// Transaction represents a miles transaction (earn or spend)
type Transaction struct {
	ID              uuid.UUID       `json:"id"`
	UserID          string          `json:"user_id"`
	TransactionType string          `json:"transaction_type"`
	Amount          decimal.Decimal `json:"amount"`
	SourceType      string          `json:"source_type"`
	SourceID        *string         `json:"source_id,omitempty"`
	Description     string          `json:"description"`
	Metadata        map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

// CatalogItem represents an item in the redemption catalog
type CatalogItem struct {
	ID            string                 `json:"id"`
	Category      string                 `json:"category"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description"`
	MilesCost     decimal.Decimal        `json:"miles_cost"`
	StockQuantity *int                   `json:"stock_quantity,omitempty"`
	Available     bool                   `json:"available"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	ImageURL      *string                `json:"image_url,omitempty"`
	SortOrder     int                    `json:"sort_order"`
	CreatedAt     time.Time              `json:"created_at"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

// Redemption represents a redemption transaction
type Redemption struct {
	ID              uuid.UUID              `json:"id"`
	UserID          string                 `json:"user_id"`
	RedemptionType  string                 `json:"redemption_type"`
	ItemID          string                 `json:"item_id"`
	MilesCost       decimal.Decimal        `json:"miles_cost"`
	Status          string                 `json:"status"`
	FulfillmentData map[string]interface{} `json:"fulfillment_data,omitempty"`
	ExpiresAt       *time.Time             `json:"expires_at,omitempty"`
	CreatedAt       time.Time              `json:"created_at"`
	FulfilledAt     *time.Time             `json:"fulfilled_at,omitempty"`
}

// EarningRule represents a rule for earning miles
type EarningRule struct {
	ID           string                 `json:"id"`
	RuleType     string                 `json:"rule_type"`
	MilesFormula string                 `json:"miles_formula"`
	Conditions   map[string]interface{} `json:"conditions"`
	Active       bool                   `json:"active"`
	Priority     int                    `json:"priority"`
	Description  *string                `json:"description,omitempty"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// BalanceStats represents extended balance statistics
type BalanceStats struct {
	Balance
	NextTier          string          `json:"next_tier,omitempty"`
	MilesToNextTier   decimal.Decimal `json:"miles_to_next_tier"`
	TierBenefits      []string        `json:"tier_benefits"`
	TotalTransactions int             `json:"total_transactions"`
}

// RedeemRequest represents a request to redeem miles
type RedeemRequest struct {
	ItemID   string                 `json:"item_id"`
	Quantity int                    `json:"quantity"`
	Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// CreateCatalogItemRequest represents a request to create a catalog item
type CreateCatalogItemRequest struct {
	ID            string                 `json:"id"`
	Category      string                 `json:"category"`
	Name          string                 `json:"name"`
	Description   string                 `json:"description"`
	MilesCost     decimal.Decimal        `json:"miles_cost"`
	StockQuantity *int                   `json:"stock_quantity,omitempty"`
	Available     bool                   `json:"available"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	ImageURL      *string                `json:"image_url,omitempty"`
	SortOrder     int                    `json:"sort_order"`
}

// UpdateCatalogItemRequest represents a request to update a catalog item
type UpdateCatalogItemRequest struct {
	Name          *string                 `json:"name,omitempty"`
	Description   *string                 `json:"description,omitempty"`
	MilesCost     *decimal.Decimal        `json:"miles_cost,omitempty"`
	StockQuantity *int                    `json:"stock_quantity,omitempty"`
	Available     *bool                   `json:"available,omitempty"`
	Metadata      *map[string]interface{} `json:"metadata,omitempty"`
	ImageURL      *string                 `json:"image_url,omitempty"`
	SortOrder     *int                    `json:"sort_order,omitempty"`
}

// AwardMilesRequest represents a manual award request
type AwardMilesRequest struct {
	UserID      string          `json:"user_id"`
	Amount      decimal.Decimal `json:"amount"`
	SourceType  string          `json:"source_type"`
	Description string          `json:"description"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// EarningContext represents the context for earning miles
type EarningContext struct {
	UserID         string
	XP             *decimal.Decimal
	PnL            *decimal.Decimal
	Position       *int
	StreakLength   *int
	CompetitionID  *uuid.UUID
	TradeID        *uuid.UUID
	AdditionalData map[string]interface{}
}

// TierThresholds defines the miles thresholds for each tier
var TierThresholds = map[string]decimal.Decimal{
	TierBronze:   decimal.NewFromInt(0),
	TierSilver:   decimal.NewFromInt(1000),
	TierGold:     decimal.NewFromInt(5000),
	TierPlatinum: decimal.NewFromInt(10000),
}

// GetNextTier returns the next tier and miles needed
func GetNextTier(currentTier string, totalEarned decimal.Decimal) (string, decimal.Decimal) {
	switch currentTier {
	case TierBronze:
		return TierSilver, TierThresholds[TierSilver].Sub(totalEarned)
	case TierSilver:
		return TierGold, TierThresholds[TierGold].Sub(totalEarned)
	case TierGold:
		return TierPlatinum, TierThresholds[TierPlatinum].Sub(totalEarned)
	case TierPlatinum:
		return "", decimal.Zero
	default:
		return TierSilver, TierThresholds[TierSilver].Sub(totalEarned)
	}
}

// GetTierBenefits returns the benefits for a tier
func GetTierBenefits(tier string) []string {
	benefits := map[string][]string{
		TierBronze: {
			"Basic marketplace access",
			"Standard redemption rates",
		},
		TierSilver: {
			"5% discount on all redemptions",
			"Priority customer support",
			"Exclusive silver badge",
		},
		TierGold: {
			"10% discount on all redemptions",
			"Early access to new features",
			"Gold profile badge",
			"Monthly bonus miles",
		},
		TierPlatinum: {
			"15% discount on all redemptions",
			"VIP customer support",
			"Platinum profile badge",
			"Exclusive competitions access",
			"Weekly bonus miles",
			"Free AI analysis credits",
		},
	}
	
	return benefits[tier]
}
