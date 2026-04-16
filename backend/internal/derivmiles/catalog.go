package derivmiles

import (
	"context"
	"fmt"
	"sort"

	"github.com/shopspring/decimal"
)

// CatalogManager handles catalog operations
type CatalogManager struct {
	store *Store
}

// NewCatalogManager creates a new catalog manager
func NewCatalogManager(store *Store) *CatalogManager {
	return &CatalogManager{store: store}
}

// GetCatalogWithPricing returns catalog items with tier-adjusted pricing
func (c *CatalogManager) GetCatalogWithPricing(ctx context.Context, userID, category string) ([]map[string]interface{}, error) {
	items, err := c.store.ListCatalogItems(ctx, category, true)
	if err != nil {
		return nil, fmt.Errorf("list catalog items: %w", err)
	}
	
	var tier string
	if userID != "" {
		balance, err := c.store.GetBalance(ctx, userID)
		if err == nil {
			tier = balance.Tier
		} else {
			tier = TierBronze
		}
	} else {
		tier = TierBronze
	}
	
	result := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		baseCost := item.MilesCost
		finalCost := ApplyTierDiscount(tier, baseCost)
		
		discount := decimal.Zero
		if !baseCost.Equal(finalCost) {
			discount = baseCost.Sub(finalCost)
		}
		
		itemMap := map[string]interface{}{
			"id":             item.ID,
			"category":       item.Category,
			"name":           item.Name,
			"description":    item.Description,
			"base_cost":      baseCost,
			"final_cost":     finalCost,
			"discount":       discount,
			"stock_quantity": item.StockQuantity,
			"available":      item.Available,
			"metadata":       item.Metadata,
			"image_url":      item.ImageURL,
			"sort_order":     item.SortOrder,
		}
		
		result = append(result, itemMap)
	}
	
	return result, nil
}

// GetFeaturedItems returns featured catalog items
func (c *CatalogManager) GetFeaturedItems(ctx context.Context, limit int) ([]CatalogItem, error) {
	items, err := c.store.ListCatalogItems(ctx, "", true)
	if err != nil {
		return nil, fmt.Errorf("list catalog items: %w", err)
	}
	
	sort.Slice(items, func(i, j int) bool {
		return items[i].SortOrder < items[j].SortOrder
	})
	
	if len(items) > limit {
		items = items[:limit]
	}
	
	return items, nil
}

// GetCategoryItems returns items for a specific category
func (c *CatalogManager) GetCategoryItems(ctx context.Context, category string) ([]CatalogItem, error) {
	return c.store.ListCatalogItems(ctx, category, true)
}

// SearchCatalog searches catalog items by name or description
func (c *CatalogManager) SearchCatalog(ctx context.Context, query string) ([]CatalogItem, error) {
	items, err := c.store.ListCatalogItems(ctx, "", true)
	if err != nil {
		return nil, fmt.Errorf("list catalog items: %w", err)
	}
	
	if query == "" {
		return items, nil
	}
	
	filtered := make([]CatalogItem, 0)
	for _, item := range items {
		if contains(item.Name, query) || contains(item.Description, query) {
			filtered = append(filtered, item)
		}
	}
	
	return filtered, nil
}

// GetItemAvailability checks if an item is available for purchase
func (c *CatalogManager) GetItemAvailability(ctx context.Context, itemID string) (bool, string, error) {
	item, err := c.store.GetCatalogItem(ctx, itemID)
	if err != nil {
		return false, "Item not found", err
	}
	
	if !item.Available {
		return false, "Item is currently unavailable", nil
	}
	
	if item.StockQuantity != nil && *item.StockQuantity <= 0 {
		return false, "Item is out of stock", nil
	}
	
	return true, "Available", nil
}

// ValidateCatalogItem validates a catalog item configuration
func (c *CatalogManager) ValidateCatalogItem(req CreateCatalogItemRequest) error {
	if req.ID == "" {
		return fmt.Errorf("item ID is required")
	}
	
	if req.Name == "" {
		return fmt.Errorf("item name is required")
	}
	
	if req.Description == "" {
		return fmt.Errorf("item description is required")
	}
	
	if req.MilesCost.LessThanOrEqual(decimal.Zero) {
		return fmt.Errorf("miles cost must be positive")
	}
	
	validCategories := []string{
		CategoryAIAnalysis,
		CategoryPremiumFeature,
		CategoryThirdPartyTool,
		CategoryMarketplaceItem,
		CategoryTradingBenefit,
	}
	
	valid := false
	for _, cat := range validCategories {
		if req.Category == cat {
			valid = true
			break
		}
	}
	
	if !valid {
		return fmt.Errorf("invalid category: %s", req.Category)
	}
	
	if req.StockQuantity != nil && *req.StockQuantity < 0 {
		return fmt.Errorf("stock quantity cannot be negative")
	}
	
	return nil
}

// GetCatalogStats returns statistics about the catalog
func (c *CatalogManager) GetCatalogStats(ctx context.Context) (map[string]interface{}, error) {
	items, err := c.store.ListCatalogItems(ctx, "", false)
	if err != nil {
		return nil, fmt.Errorf("list catalog items: %w", err)
	}
	
	stats := map[string]interface{}{
		"total_items":     len(items),
		"available_items": 0,
		"by_category":     make(map[string]int),
	}
	
	categoryStats := make(map[string]int)
	availableCount := 0
	
	for _, item := range items {
		categoryStats[item.Category]++
		if item.Available {
			availableCount++
		}
	}
	
	stats["available_items"] = availableCount
	stats["by_category"] = categoryStats
	
	return stats, nil
}

// GetPopularItems returns most redeemed items (would need redemption tracking)
func (c *CatalogManager) GetPopularItems(ctx context.Context, limit int) ([]map[string]interface{}, error) {
	items, err := c.store.ListCatalogItems(ctx, "", true)
	if err != nil {
		return nil, fmt.Errorf("list catalog items: %w", err)
	}
	
	if len(items) > limit {
		items = items[:limit]
	}
	
	result := make([]map[string]interface{}, 0, len(items))
	for _, item := range items {
		result = append(result, map[string]interface{}{
			"id":          item.ID,
			"name":        item.Name,
			"category":    item.Category,
			"miles_cost":  item.MilesCost,
			"image_url":   item.ImageURL,
		})
	}
	
	return result, nil
}

// GetRecommendations returns personalized catalog recommendations
func (c *CatalogManager) GetRecommendations(ctx context.Context, userID string, limit int) ([]CatalogItem, error) {
	balance, err := c.store.GetBalance(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get balance: %w", err)
	}
	
	items, err := c.store.ListCatalogItems(ctx, "", true)
	if err != nil {
		return nil, fmt.Errorf("list catalog items: %w", err)
	}
	
	affordable := make([]CatalogItem, 0)
	for _, item := range items {
		finalCost := ApplyTierDiscount(balance.Tier, item.MilesCost)
		if balance.CurrentBalance.GreaterThanOrEqual(finalCost) {
			affordable = append(affordable, item)
		}
	}
	
	sort.Slice(affordable, func(i, j int) bool {
		return affordable[i].MilesCost.LessThan(affordable[j].MilesCost)
	})
	
	if len(affordable) > limit {
		affordable = affordable[:limit]
	}
	
	return affordable, nil
}

// contains checks if a string contains a substring (case-insensitive)
func contains(str, substr string) bool {
	str = toLower(str)
	substr = toLower(substr)
	return len(str) >= len(substr) && str[:len(substr)] == substr || 
	       (len(str) > len(substr) && indexOfSubstring(str, substr) >= 0)
}

// toLower converts string to lowercase
func toLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		result[i] = c
	}
	return string(result)
}

// indexOfSubstring finds the index of substring in string
func indexOfSubstring(str, substr string) int {
	if len(substr) == 0 {
		return 0
	}
	if len(substr) > len(str) {
		return -1
	}
	
	for i := 0; i <= len(str)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			if str[i+j] != substr[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}
