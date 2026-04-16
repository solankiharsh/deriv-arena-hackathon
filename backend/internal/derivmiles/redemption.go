package derivmiles

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// RedemptionProcessor handles redemption fulfillment
type RedemptionProcessor struct {
	store  *Store
	engine *EarningEngine
}

// NewRedemptionProcessor creates a new redemption processor
func NewRedemptionProcessor(store *Store, engine *EarningEngine) *RedemptionProcessor {
	return &RedemptionProcessor{
		store:  store,
		engine: engine,
	}
}

// ProcessRedemption processes a redemption request
func (r *RedemptionProcessor) ProcessRedemption(ctx context.Context, userID string, req RedeemRequest) (*Redemption, error) {
	item, err := r.store.GetCatalogItem(ctx, req.ItemID)
	if err != nil {
		return nil, fmt.Errorf("get catalog item: %w", err)
	}
	
	if !item.Available {
		return nil, fmt.Errorf("item is not available")
	}
	
	if item.StockQuantity != nil && *item.StockQuantity <= 0 {
		return nil, fmt.Errorf("item is out of stock")
	}
	
	balance, err := r.store.GetBalance(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get balance: %w", err)
	}
	
	finalCost := ApplyTierDiscount(balance.Tier, item.MilesCost)
	
	totalCost := finalCost.Mul(decimal.NewFromInt(int64(req.Quantity)))
	
	if balance.CurrentBalance.LessThan(totalCost) {
		return nil, fmt.Errorf("insufficient miles: have %s, need %s", balance.CurrentBalance.String(), totalCost.String())
	}
	
	redemption, err := r.store.CreateRedemption(ctx, userID, req.ItemID, totalCost, item.Category)
	if err != nil {
		return nil, fmt.Errorf("create redemption: %w", err)
	}
	
	description := fmt.Sprintf("Redeemed: %s", item.Name)
	_, err = r.store.SpendMiles(ctx, userID, totalCost, description, map[string]interface{}{
		"item_id":      req.ItemID,
		"item_name":    item.Name,
		"quantity":     req.Quantity,
		"redemption_id": redemption.ID.String(),
	})
	if err != nil {
		return nil, fmt.Errorf("spend miles: %w", err)
	}
	
	fulfillmentData, expiresAt, err := r.fulfillItem(ctx, userID, item, req)
	if err != nil {
		if refundErr := r.refundRedemption(ctx, userID, redemption.ID, totalCost, item.Name); refundErr != nil {
			return nil, fmt.Errorf("fulfillment failed and refund failed: %v, %v", err, refundErr)
		}
		
		return nil, fmt.Errorf("fulfillment failed (refunded): %w", err)
	}
	
	err = r.store.UpdateRedemptionStatus(ctx, redemption.ID, RedemptionStatusFulfilled, fulfillmentData, expiresAt)
	if err != nil {
		return nil, fmt.Errorf("update redemption status: %w", err)
	}
	
	redemption.Status = RedemptionStatusFulfilled
	redemption.FulfillmentData = fulfillmentData
	redemption.ExpiresAt = expiresAt
	now := time.Now()
	redemption.FulfilledAt = &now
	
	return redemption, nil
}

// fulfillItem handles category-specific fulfillment logic
func (r *RedemptionProcessor) fulfillItem(ctx context.Context, userID string, item *CatalogItem, req RedeemRequest) (map[string]interface{}, *time.Time, error) {
	switch item.Category {
	case CategoryAIAnalysis:
		return r.fulfillAIAnalysis(ctx, userID, item, req)
	case CategoryPremiumFeature:
		return r.fulfillPremiumFeature(ctx, userID, item, req)
	case CategoryThirdPartyTool:
		return r.fulfillThirdPartyTool(ctx, userID, item, req)
	case CategoryMarketplaceItem:
		return r.fulfillMarketplaceItem(ctx, userID, item, req)
	case CategoryTradingBenefit:
		return r.fulfillTradingBenefit(ctx, userID, item, req)
	default:
		return nil, nil, fmt.Errorf("unknown category: %s", item.Category)
	}
}

// fulfillAIAnalysis handles AI analysis redemption
func (r *RedemptionProcessor) fulfillAIAnalysis(ctx context.Context, userID string, item *CatalogItem, req RedeemRequest) (map[string]interface{}, *time.Time, error) {
	fulfillmentData := map[string]interface{}{
		"status":         "ready",
		"analysis_type":  item.Metadata["analysis_depth"],
		"trades_allowed": item.Metadata["trades_analyzed"],
		"instructions":   "Visit the AI Analysis page to generate your analysis",
	}
	
	if tradeID, ok := req.Metadata["trade_id"].(string); ok {
		fulfillmentData["trade_id"] = tradeID
	}
	
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	
	return fulfillmentData, &expiresAt, nil
}

// fulfillPremiumFeature handles premium feature redemption
func (r *RedemptionProcessor) fulfillPremiumFeature(ctx context.Context, userID string, item *CatalogItem, req RedeemRequest) (map[string]interface{}, *time.Time, error) {
	featureName, _ := item.Metadata["feature"].(string)
	durationDays, _ := item.Metadata["duration_days"].(float64)
	
	expiresAt := time.Now().Add(time.Duration(durationDays) * 24 * time.Hour)
	
	fulfillmentData := map[string]interface{}{
		"feature":    featureName,
		"activated":  true,
		"expires_at": expiresAt.Format(time.RFC3339),
	}
	
	return fulfillmentData, &expiresAt, nil
}

// fulfillThirdPartyTool handles third-party tool redemption
func (r *RedemptionProcessor) fulfillThirdPartyTool(ctx context.Context, userID string, item *CatalogItem, req RedeemRequest) (map[string]interface{}, *time.Time, error) {
	voucherCode := fmt.Sprintf("DERIV-%s-%s", uuid.New().String()[:8], item.ID[:8])
	
	fulfillmentData := map[string]interface{}{
		"voucher_code": voucherCode,
		"instructions": "Use this voucher code to redeem your credits at the partner site",
		"partner_url":  item.Metadata["partner_url"],
	}
	
	expiresAt := time.Now().Add(90 * 24 * time.Hour)
	
	return fulfillmentData, &expiresAt, nil
}

// fulfillMarketplaceItem handles marketplace item redemption
func (r *RedemptionProcessor) fulfillMarketplaceItem(ctx context.Context, userID string, item *CatalogItem, req RedeemRequest) (map[string]interface{}, *time.Time, error) {
	itemType, _ := item.Metadata["item_type"].(string)
	
	fulfillmentData := map[string]interface{}{
		"item_type": itemType,
		"activated": true,
		"asset_url": item.ImageURL,
	}
	
	if itemType == "avatar" {
		fulfillmentData["rarity"] = item.Metadata["rarity"]
	} else if itemType == "theme" {
		fulfillmentData["theme_id"] = item.Metadata["theme_id"]
	} else if itemType == "animation" {
		fulfillmentData["animation_id"] = item.Metadata["animation_id"]
	}
	
	return fulfillmentData, nil, nil
}

// fulfillTradingBenefit handles trading benefit redemption
func (r *RedemptionProcessor) fulfillTradingBenefit(ctx context.Context, userID string, item *CatalogItem, req RedeemRequest) (map[string]interface{}, *time.Time, error) {
	benefitType, _ := item.Metadata["benefit_type"].(string)
	
	fulfillmentData := map[string]interface{}{
		"benefit_type": benefitType,
		"activated":    true,
	}
	
	switch benefitType {
	case "bonus_balance":
		amount, _ := item.Metadata["amount"].(float64)
		fulfillmentData["bonus_amount"] = amount
		fulfillmentData["instructions"] = fmt.Sprintf("$%.2f bonus will be added to your next competition entry", amount)
		
	case "fee_waiver":
		trades, _ := item.Metadata["trades"].(float64)
		fulfillmentData["trades_remaining"] = int(trades)
		fulfillmentData["instructions"] = fmt.Sprintf("Reduced fees on your next %.0f trades", trades)
		
	case "exotic_access":
		competitions, _ := item.Metadata["duration_competitions"].(float64)
		fulfillmentData["competitions_remaining"] = int(competitions)
		fulfillmentData["instructions"] = "Exotic contracts unlocked for your next competition"
		
	case "instant_replay":
		uses, _ := item.Metadata["uses"].(float64)
		fulfillmentData["uses_remaining"] = int(uses)
		fulfillmentData["instructions"] = "Use this token to reset one losing position"
	}
	
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	
	return fulfillmentData, &expiresAt, nil
}

// refundRedemption refunds a failed redemption
func (r *RedemptionProcessor) refundRedemption(ctx context.Context, userID string, redemptionID uuid.UUID, amount decimal.Decimal, itemName string) error {
	description := fmt.Sprintf("Refund for failed redemption: %s", itemName)
	metadata := map[string]interface{}{
		"redemption_id": redemptionID.String(),
		"refund_reason": "fulfillment_failed",
	}
	
	_, err := r.store.AwardMiles(ctx, userID, amount, SourceTypeManual, redemptionID.String(), description, metadata)
	if err != nil {
		return fmt.Errorf("refund miles: %w", err)
	}
	
	err = r.store.UpdateRedemptionStatus(ctx, redemptionID, RedemptionStatusRefunded, map[string]interface{}{
		"refunded": true,
		"reason":   "fulfillment_failed",
	}, nil)
	if err != nil {
		return fmt.Errorf("update redemption to refunded: %w", err)
	}
	
	return nil
}

// GetRedemptionDetails retrieves full details of a redemption including item info
func (r *RedemptionProcessor) GetRedemptionDetails(ctx context.Context, redemptionID uuid.UUID) (map[string]interface{}, error) {
	return map[string]interface{}{
		"message": "Redemption details retrieval not yet implemented",
	}, nil
}

// CancelRedemption cancels a pending redemption and refunds miles
func (r *RedemptionProcessor) CancelRedemption(ctx context.Context, userID string, redemptionID uuid.UUID) error {
	return fmt.Errorf("cancellation not supported")
}

// GetUserPremiumFeatures returns active premium features for a user
func (r *RedemptionProcessor) GetUserPremiumFeatures(ctx context.Context, userID string) (map[string]interface{}, error) {
	redemptions, err := r.store.ListRedemptions(ctx, userID, RedemptionStatusFulfilled, 100, 0)
	if err != nil {
		return nil, fmt.Errorf("list redemptions: %w", err)
	}
	
	activeFeatures := make(map[string]interface{})
	now := time.Now()
	
	for _, redemption := range redemptions {
		if redemption.RedemptionType != CategoryPremiumFeature {
			continue
		}
		
		if redemption.ExpiresAt != nil && redemption.ExpiresAt.Before(now) {
			continue
		}
		
		if feature, ok := redemption.FulfillmentData["feature"].(string); ok {
			activeFeatures[feature] = map[string]interface{}{
				"activated_at": redemption.FulfilledAt,
				"expires_at":   redemption.ExpiresAt,
				"active":       true,
			}
		}
	}
	
	return activeFeatures, nil
}

// GetUserMarketplaceItems returns owned marketplace items for a user
func (r *RedemptionProcessor) GetUserMarketplaceItems(ctx context.Context, userID string) ([]map[string]interface{}, error) {
	redemptions, err := r.store.ListRedemptions(ctx, userID, RedemptionStatusFulfilled, 100, 0)
	if err != nil {
		return nil, fmt.Errorf("list redemptions: %w", err)
	}
	
	items := make([]map[string]interface{}, 0)
	
	for _, redemption := range redemptions {
		if redemption.RedemptionType != CategoryMarketplaceItem {
			continue
		}
		
		item := map[string]interface{}{
			"redemption_id": redemption.ID,
			"item_id":       redemption.ItemID,
			"acquired_at":   redemption.FulfilledAt,
		}
		
		for k, v := range redemption.FulfillmentData {
			item[k] = v
		}
		
		items = append(items, item)
	}
	
	return items, nil
}

// GetUserTradingBenefits returns active trading benefits for a user
func (r *RedemptionProcessor) GetUserTradingBenefits(ctx context.Context, userID string) (map[string]interface{}, error) {
	redemptions, err := r.store.ListRedemptions(ctx, userID, RedemptionStatusFulfilled, 100, 0)
	if err != nil {
		return nil, fmt.Errorf("list redemptions: %w", err)
	}
	
	benefits := make(map[string]interface{})
	now := time.Now()
	
	for _, redemption := range redemptions {
		if redemption.RedemptionType != CategoryTradingBenefit {
			continue
		}
		
		if redemption.ExpiresAt != nil && redemption.ExpiresAt.Before(now) {
			continue
		}
		
		if benefitType, ok := redemption.FulfillmentData["benefit_type"].(string); ok {
			benefits[benefitType] = redemption.FulfillmentData
		}
	}
	
	return benefits, nil
}
