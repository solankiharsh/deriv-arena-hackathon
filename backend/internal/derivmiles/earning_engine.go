package derivmiles

import (
	"context"
	"fmt"
	"math"

	"github.com/shopspring/decimal"
)

// EarningEngine handles miles earning calculations and awards
type EarningEngine struct {
	store *Store
}

// NewEarningEngine creates a new earning engine
func NewEarningEngine(store *Store) *EarningEngine {
	return &EarningEngine{store: store}
}

// ProcessXPEarning awards miles based on XP earned
func (e *EarningEngine) ProcessXPEarning(ctx context.Context, userID string, xpAmount decimal.Decimal) error {
	if xpAmount.LessThanOrEqual(decimal.Zero) {
		return nil
	}
	
	conversionRate := decimal.NewFromInt(10)
	milesEarned := xpAmount.Div(conversionRate).Floor()
	
	if milesEarned.LessThanOrEqual(decimal.Zero) {
		return nil
	}
	
	description := fmt.Sprintf("Earned %s miles from %s XP", milesEarned.String(), xpAmount.String())
	metadata := map[string]interface{}{
		"xp_amount":       xpAmount.String(),
		"conversion_rate": 10,
	}
	
	sourceID := fmt.Sprintf("xp_%s_%d", userID, ctx.Value("timestamp"))
	
	_, err := e.store.AwardMiles(ctx, userID, milesEarned, SourceTypeXP, sourceID, description, metadata)
	if err != nil {
		return fmt.Errorf("award XP miles: %w", err)
	}
	
	return nil
}

// ProcessProfitableTrade awards miles based on profitable trade PnL
func (e *EarningEngine) ProcessProfitableTrade(ctx context.Context, userID, tradeID string, pnl decimal.Decimal) error {
	if pnl.LessThanOrEqual(decimal.Zero) {
		return nil
	}
	
	multiplier := decimal.NewFromFloat(0.005)
	milesEarned := pnl.Mul(multiplier)
	
	minMiles := decimal.NewFromInt(1)
	maxMiles := decimal.NewFromInt(50)
	
	if milesEarned.LessThan(minMiles) {
		milesEarned = minMiles
	}
	if milesEarned.GreaterThan(maxMiles) {
		milesEarned = maxMiles
	}
	
	milesEarned = milesEarned.Floor()
	
	description := fmt.Sprintf("Earned %s miles from profitable trade (PnL: %s)", milesEarned.String(), pnl.String())
	metadata := map[string]interface{}{
		"pnl":        pnl.String(),
		"trade_id":   tradeID,
		"multiplier": 0.005,
	}
	
	sourceID := fmt.Sprintf("trade_%s", tradeID)
	
	_, err := e.store.AwardMiles(ctx, userID, milesEarned, SourceTypeProfitableTrade, sourceID, description, metadata)
	if err != nil {
		return fmt.Errorf("award trade miles: %w", err)
	}
	
	return nil
}

// ProcessCompetitionWin awards miles for competition placement
func (e *EarningEngine) ProcessCompetitionWin(ctx context.Context, userID, competitionID string, position int) error {
	var milesEarned decimal.Decimal
	var positionName string
	
	switch position {
	case 1:
		milesEarned = decimal.NewFromInt(500)
		positionName = "1st place"
	case 2:
		milesEarned = decimal.NewFromInt(200)
		positionName = "2nd place"
	case 3:
		milesEarned = decimal.NewFromInt(200)
		positionName = "3rd place"
	default:
		return nil
	}
	
	description := fmt.Sprintf("Earned %s miles for %s in competition", milesEarned.String(), positionName)
	metadata := map[string]interface{}{
		"competition_id": competitionID,
		"position":       position,
	}
	
	sourceID := fmt.Sprintf("comp_win_%s_%s", competitionID, userID)
	
	_, err := e.store.AwardMiles(ctx, userID, milesEarned, SourceTypeCompetitionWin, sourceID, description, metadata)
	if err != nil {
		return fmt.Errorf("award competition win miles: %w", err)
	}
	
	return nil
}

// ProcessWinStreak awards miles for win streaks
func (e *EarningEngine) ProcessWinStreak(ctx context.Context, userID string, streakLength int) error {
	var milesEarned decimal.Decimal
	var description string
	
	switch {
	case streakLength >= 10:
		milesEarned = decimal.NewFromInt(250)
		description = fmt.Sprintf("Earned %s miles for 10-trade win streak!", milesEarned.String())
	case streakLength >= 5:
		milesEarned = decimal.NewFromInt(100)
		description = fmt.Sprintf("Earned %s miles for 5-trade win streak!", milesEarned.String())
	default:
		return nil
	}
	
	metadata := map[string]interface{}{
		"streak_length": streakLength,
	}
	
	sourceID := fmt.Sprintf("streak_%s_%d", userID, streakLength)
	
	_, err := e.store.AwardMiles(ctx, userID, milesEarned, SourceTypeWinStreak, sourceID, description, metadata)
	if err != nil {
		return fmt.Errorf("award win streak miles: %w", err)
	}
	
	return nil
}

// ProcessDailyLogin awards miles for daily login
func (e *EarningEngine) ProcessDailyLogin(ctx context.Context, userID string) error {
	milesEarned := decimal.NewFromInt(5)
	description := fmt.Sprintf("Daily login bonus: %s miles", milesEarned.String())
	metadata := map[string]interface{}{
		"bonus_type": "daily_login",
	}
	
	sourceID := fmt.Sprintf("daily_login_%s_%s", userID, ctx.Value("date"))
	
	_, err := e.store.AwardMiles(ctx, userID, milesEarned, SourceTypeDailyLogin, sourceID, description, metadata)
	if err != nil {
		return fmt.Errorf("award daily login miles: %w", err)
	}
	
	return nil
}

// CalculateMilesFromContext calculates miles based on earning context
func (e *EarningEngine) CalculateMilesFromContext(ctx context.Context, earningCtx *EarningContext) (decimal.Decimal, error) {
	totalMiles := decimal.Zero
	
	if earningCtx.XP != nil && earningCtx.XP.GreaterThan(decimal.Zero) {
		conversionRate := decimal.NewFromInt(10)
		xpMiles := earningCtx.XP.Div(conversionRate).Floor()
		totalMiles = totalMiles.Add(xpMiles)
	}
	
	if earningCtx.PnL != nil && earningCtx.PnL.GreaterThan(decimal.Zero) {
		multiplier := decimal.NewFromFloat(0.005)
		tradeMiles := earningCtx.PnL.Mul(multiplier)
		
		minMiles := decimal.NewFromInt(1)
		maxMiles := decimal.NewFromInt(50)
		
		if tradeMiles.LessThan(minMiles) {
			tradeMiles = minMiles
		}
		if tradeMiles.GreaterThan(maxMiles) {
			tradeMiles = maxMiles
		}
		
		totalMiles = totalMiles.Add(tradeMiles.Floor())
	}
	
	if earningCtx.Position != nil {
		switch *earningCtx.Position {
		case 1:
			totalMiles = totalMiles.Add(decimal.NewFromInt(500))
		case 2, 3:
			totalMiles = totalMiles.Add(decimal.NewFromInt(200))
		}
	}
	
	if earningCtx.StreakLength != nil {
		switch {
		case *earningCtx.StreakLength >= 10:
			totalMiles = totalMiles.Add(decimal.NewFromInt(250))
		case *earningCtx.StreakLength >= 5:
			totalMiles = totalMiles.Add(decimal.NewFromInt(100))
		}
	}
	
	return totalMiles, nil
}

// ApplyTierDiscount applies tier-based discount to redemption cost
func ApplyTierDiscount(tier string, baseCost decimal.Decimal) decimal.Decimal {
	discountMap := map[string]float64{
		TierBronze:   0.0,
		TierSilver:   0.05,
		TierGold:     0.10,
		TierPlatinum: 0.15,
	}
	
	discount, ok := discountMap[tier]
	if !ok {
		discount = 0.0
	}
	
	if discount == 0.0 {
		return baseCost
	}
	
	discountAmount := baseCost.Mul(decimal.NewFromFloat(discount))
	finalCost := baseCost.Sub(discountAmount)
	
	return finalCost.Ceil()
}

// clamp helper function
func clamp(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

// CalculateDailyEarningLimit checks if user has reached daily earning limit
func (e *EarningEngine) CalculateDailyEarningLimit(ctx context.Context, userID string, maxDailyMiles int) (bool, error) {
	return false, nil
}

// GetEarningOpportunities returns available earning opportunities for a user
func (e *EarningEngine) GetEarningOpportunities(ctx context.Context, userID string) ([]map[string]interface{}, error) {
	opportunities := []map[string]interface{}{
		{
			"type":        "profitable_trade",
			"title":       "Make Profitable Trades",
			"description": "Earn 1-50 miles per profitable trade based on PnL",
			"icon":        "trending-up",
		},
		{
			"type":        "competition_win",
			"title":       "Win Competitions",
			"description": "Earn 500 miles for 1st place, 200 miles for top 3",
			"icon":        "trophy",
		},
		{
			"type":        "win_streak",
			"title":       "Build Win Streaks",
			"description": "100 miles for 5-win streak, 250 miles for 10-win streak",
			"icon":        "flame",
		},
		{
			"type":        "xp",
			"title":       "Level Up Your Agent",
			"description": "Convert XP to miles at 10 XP = 1 mile",
			"icon":        "star",
		},
		{
			"type":        "daily_login",
			"title":       "Daily Login Bonus",
			"description": "Earn 5 miles every day you log in",
			"icon":        "calendar",
		},
	}
	
	return opportunities, nil
}

// ValidateMilesAmount validates a miles amount
func ValidateMilesAmount(amount decimal.Decimal) error {
	if amount.LessThanOrEqual(decimal.Zero) {
		return fmt.Errorf("miles amount must be positive")
	}
	
	if amount.GreaterThan(decimal.NewFromInt(1000000)) {
		return fmt.Errorf("miles amount exceeds maximum")
	}
	
	fractionalPart := amount.Sub(amount.Floor())
	tolerance := decimal.NewFromFloat(0.001)
	if fractionalPart.GreaterThan(tolerance) {
		return fmt.Errorf("miles amount must be a whole number")
	}
	
	return nil
}

// CalculateXPFromMiles converts miles back to XP (for reference)
func CalculateXPFromMiles(miles decimal.Decimal) decimal.Decimal {
	conversionRate := decimal.NewFromInt(10)
	return miles.Mul(conversionRate)
}

// roundToDecimal rounds a float to specified decimal places
func roundToDecimal(val float64, precision int) float64 {
	ratio := math.Pow(10, float64(precision))
	return math.Round(val*ratio) / ratio
}
