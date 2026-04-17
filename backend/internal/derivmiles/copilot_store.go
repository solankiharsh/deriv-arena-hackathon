package derivmiles

import (
	"context"
	"fmt"
	"time"
)

// UpsertTradingCopilotEntitlement adds message credits and extends the access window
// when redeeming Trading Copilot packs. If the prior window expired, credits reset to the new pack only.
func (s *Store) UpsertTradingCopilotEntitlement(ctx context.Context, userID string, addCredits int, newExpiresAt time.Time) error {
	if addCredits < 0 {
		return fmt.Errorf("addCredits must be non-negative")
	}
	query := `
		INSERT INTO deriv_trading_copilot_entitlements (user_id, credits_remaining, expires_at, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			credits_remaining = CASE
				WHEN deriv_trading_copilot_entitlements.expires_at > NOW() THEN
					deriv_trading_copilot_entitlements.credits_remaining + EXCLUDED.credits_remaining
				ELSE EXCLUDED.credits_remaining
			END,
			expires_at = GREATEST(deriv_trading_copilot_entitlements.expires_at, EXCLUDED.expires_at),
			updated_at = NOW()
	`
	_, err := s.pool.Exec(ctx, query, userID, addCredits, newExpiresAt)
	if err != nil {
		return fmt.Errorf("upsert trading copilot entitlement: %w", err)
	}
	return nil
}
