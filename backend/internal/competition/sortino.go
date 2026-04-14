package competition

import (
	"context"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// CalculateSortino computes Sortino ratio for a participant using their trade history.
// Formula: (Mean Return - Risk-Free Rate) / Downside Deviation
// Only negative returns are used for downside deviation calculation.
func (s *Store) CalculateSortino(ctx context.Context, participantID uuid.UUID, riskFreeRate float64) error {
	// Fetch all closed trades with PnL
	query := `
		SELECT pnl
		FROM competition_trades
		WHERE participant_id = $1 AND pnl IS NOT NULL
		ORDER BY executed_at ASC
	`

	rows, err := s.pool.Query(ctx, query, participantID)
	if err != nil {
		return fmt.Errorf("query trades: %w", err)
	}
	defer rows.Close()

	var returns []float64
	var totalPnL decimal.Decimal
	winningTrades := 0

	for rows.Next() {
		var pnl decimal.Decimal
		if err := rows.Scan(&pnl); err != nil {
			return fmt.Errorf("scan pnl: %w", err)
		}

		pnlFloat, _ := pnl.Float64()
		returns = append(returns, pnlFloat)
		totalPnL = totalPnL.Add(pnl)
		
		if pnl.IsPositive() {
			winningTrades++
		}
	}

	if len(returns) == 0 {
		// No trades yet - Sortino is null
		return nil
	}

	// Calculate mean return
	sum := 0.0
	for _, r := range returns {
		sum += r
	}
	meanReturn := sum / float64(len(returns))

	// Calculate downside deviation (only negative returns)
	negativeReturns := []float64{}
	for _, r := range returns {
		if r < 0 {
			negativeReturns = append(negativeReturns, r)
		}
	}

	downsideDeviation := calculateDownsideDeviation(negativeReturns)

	// Calculate Sortino Ratio
	var sortinoRatio float64
	if downsideDeviation > 0 {
		sortinoRatio = (meanReturn - riskFreeRate) / downsideDeviation
	} else if meanReturn > 0 {
		// No downside but positive returns = high Sortino
		sortinoRatio = 10.0
	} else {
		sortinoRatio = 0
	}

	// Calculate max drawdown
	maxDrawdown := calculateMaxDrawdown(returns)

	// Update competition_stats
	updateQuery := `
		UPDATE competition_stats
		SET sortino_ratio = $1, max_drawdown = $2, last_updated = NOW()
		WHERE participant_id = $3
	`

	_, err = s.pool.Exec(ctx, updateQuery,
		decimal.NewFromFloat(sortinoRatio),
		decimal.NewFromFloat(maxDrawdown),
		participantID,
	)
	if err != nil {
		return fmt.Errorf("update sortino: %w", err)
	}

	return nil
}

// calculateDownsideDeviation computes standard deviation of negative returns.
func calculateDownsideDeviation(negativeReturns []float64) float64 {
	if len(negativeReturns) == 0 {
		return 0
	}

	// Calculate mean of negative returns
	sum := 0.0
	for _, r := range negativeReturns {
		sum += r
	}
	mean := sum / float64(len(negativeReturns))

	// Calculate variance
	sumSquaredDiffs := 0.0
	for _, r := range negativeReturns {
		diff := r - mean
		sumSquaredDiffs += diff * diff
	}
	variance := sumSquaredDiffs / float64(len(negativeReturns))

	return math.Sqrt(variance)
}

// calculateMaxDrawdown computes maximum peak-to-trough decline as a percentage.
func calculateMaxDrawdown(returns []float64) float64 {
	peak := 0.0
	maxDrawdown := 0.0
	cumulative := 0.0

	for _, ret := range returns {
		cumulative += ret
		if cumulative > peak {
			peak = cumulative
		}

		// Drawdown as percentage of peak
		peakAbs := math.Max(math.Abs(peak), 1)
		drawdown := (peak - cumulative) / peakAbs
		
		if drawdown > maxDrawdown {
			maxDrawdown = drawdown
		}
	}

	return maxDrawdown
}

// RecalculateAllSortino recalculates Sortino ratios for all participants in a competition.
func (s *Store) RecalculateAllSortino(ctx context.Context, competitionID uuid.UUID) error {
	// Get all participants
	participants, err := s.ListParticipants(ctx, competitionID)
	if err != nil {
		return fmt.Errorf("list participants: %w", err)
	}

	for _, p := range participants {
		if err := s.CalculateSortino(ctx, p.ID, 0); err != nil {
			return fmt.Errorf("calculate sortino for %s: %w", p.ID, err)
		}
	}

	return nil
}
