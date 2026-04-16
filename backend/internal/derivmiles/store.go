package derivmiles

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// Store handles database operations for Deriv Miles.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new Deriv Miles store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// GetBalance retrieves a user's miles balance, creating one if it doesn't exist
func (s *Store) GetBalance(ctx context.Context, userID string) (*Balance, error) {
	query := `
		INSERT INTO deriv_miles_balances (user_id, total_earned, current_balance, total_spent, tier)
		VALUES ($1, 0, 0, 0, $2)
		ON CONFLICT (user_id) DO NOTHING
		RETURNING user_id, total_earned, current_balance, total_spent, tier, created_at, updated_at
	`
	
	var balance Balance
	err := s.pool.QueryRow(ctx, query, userID, TierBronze).Scan(
		&balance.UserID, &balance.TotalEarned, &balance.CurrentBalance,
		&balance.TotalSpent, &balance.Tier, &balance.CreatedAt, &balance.UpdatedAt,
	)
	
	if err != nil && err != pgx.ErrNoRows {
		return nil, fmt.Errorf("insert default balance: %w", err)
	}
	
	// If insert returned no rows (conflict), fetch the existing balance
	if err == pgx.ErrNoRows {
		selectQuery := `
			SELECT user_id, total_earned, current_balance, total_spent, tier, created_at, updated_at
			FROM deriv_miles_balances
			WHERE user_id = $1
		`
		err = s.pool.QueryRow(ctx, selectQuery, userID).Scan(
			&balance.UserID, &balance.TotalEarned, &balance.CurrentBalance,
			&balance.TotalSpent, &balance.Tier, &balance.CreatedAt, &balance.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("get balance: %w", err)
		}
	}
	
	return &balance, nil
}

// GetBalanceStats retrieves extended balance statistics
func (s *Store) GetBalanceStats(ctx context.Context, userID string) (*BalanceStats, error) {
	balance, err := s.GetBalance(ctx, userID)
	if err != nil {
		return nil, err
	}
	
	countQuery := `SELECT COUNT(*) FROM deriv_miles_transactions WHERE user_id = $1`
	var totalTransactions int
	err = s.pool.QueryRow(ctx, countQuery, userID).Scan(&totalTransactions)
	if err != nil {
		return nil, fmt.Errorf("count transactions: %w", err)
	}
	
	nextTier, milesToNext := GetNextTier(balance.Tier, balance.TotalEarned)
	
	stats := &BalanceStats{
		Balance:           *balance,
		NextTier:          nextTier,
		MilesToNextTier:   milesToNext,
		TierBenefits:      GetTierBenefits(balance.Tier),
		TotalTransactions: totalTransactions,
	}
	
	return stats, nil
}

// AwardMiles adds miles to a user's balance within a transaction
func (s *Store) AwardMiles(ctx context.Context, userID string, amount decimal.Decimal, sourceType, sourceID, description string, metadata map[string]interface{}) (*Transaction, error) {
	if amount.LessThanOrEqual(decimal.Zero) {
		return nil, fmt.Errorf("award amount must be positive")
	}
	
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}
	
	txnID := uuid.New()
	insertTxnQuery := `
		INSERT INTO deriv_miles_transactions (id, user_id, transaction_type, amount, source_type, source_id, description, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, user_id, transaction_type, amount, source_type, source_id, description, metadata, created_at
	`
	
	var transaction Transaction
	var metadataBytes []byte
	err = tx.QueryRow(ctx, insertTxnQuery, txnID, userID, TransactionTypeEarn, amount, sourceType, sourceID, description, metadataJSON).Scan(
		&transaction.ID, &transaction.UserID, &transaction.TransactionType,
		&transaction.Amount, &transaction.SourceType, &transaction.SourceID,
		&transaction.Description, &metadataBytes, &transaction.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert transaction: %w", err)
	}
	
	if len(metadataBytes) > 0 {
		if err := json.Unmarshal(metadataBytes, &transaction.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}
	
	updateBalanceQuery := `
		INSERT INTO deriv_miles_balances (user_id, total_earned, current_balance, total_spent, tier)
		VALUES ($1, $2, $2, 0, $3)
		ON CONFLICT (user_id) DO UPDATE SET
			total_earned = deriv_miles_balances.total_earned + $2,
			current_balance = deriv_miles_balances.current_balance + $2,
			updated_at = NOW()
	`
	
	_, err = tx.Exec(ctx, updateBalanceQuery, userID, amount, TierBronze)
	if err != nil {
		return nil, fmt.Errorf("update balance: %w", err)
	}
	
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	
	return &transaction, nil
}

// SpendMiles deducts miles from a user's balance within a transaction
func (s *Store) SpendMiles(ctx context.Context, userID string, amount decimal.Decimal, description string, metadata map[string]interface{}) (*Transaction, error) {
	if amount.LessThanOrEqual(decimal.Zero) {
		return nil, fmt.Errorf("spend amount must be positive")
	}
	
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	
	var currentBalance decimal.Decimal
	checkQuery := `SELECT current_balance FROM deriv_miles_balances WHERE user_id = $1 FOR UPDATE`
	err = tx.QueryRow(ctx, checkQuery, userID).Scan(&currentBalance)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("user has no miles balance")
		}
		return nil, fmt.Errorf("check balance: %w", err)
	}
	
	if currentBalance.LessThan(amount) {
		return nil, fmt.Errorf("insufficient miles: have %s, need %s", currentBalance.String(), amount.String())
	}
	
	metadataJSON, err := json.Marshal(metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}
	
	txnID := uuid.New()
	negativeAmount := amount.Neg()
	insertTxnQuery := `
		INSERT INTO deriv_miles_transactions (id, user_id, transaction_type, amount, source_type, source_id, description, metadata)
		VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
		RETURNING id, user_id, transaction_type, amount, source_type, source_id, description, metadata, created_at
	`
	
	var transaction Transaction
	var metadataBytes []byte
	err = tx.QueryRow(ctx, insertTxnQuery, txnID, userID, TransactionTypeSpend, negativeAmount, SourceTypeRedemption, description, metadataJSON).Scan(
		&transaction.ID, &transaction.UserID, &transaction.TransactionType,
		&transaction.Amount, &transaction.SourceType, &transaction.SourceID,
		&transaction.Description, &metadataBytes, &transaction.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert transaction: %w", err)
	}
	
	if len(metadataBytes) > 0 {
		if err := json.Unmarshal(metadataBytes, &transaction.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}
	
	updateBalanceQuery := `
		UPDATE deriv_miles_balances SET
			current_balance = current_balance - $2,
			total_spent = total_spent + $2,
			updated_at = NOW()
		WHERE user_id = $1
	`
	
	_, err = tx.Exec(ctx, updateBalanceQuery, userID, amount)
	if err != nil {
		return nil, fmt.Errorf("update balance: %w", err)
	}
	
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}
	
	return &transaction, nil
}

// ListTransactions retrieves transaction history for a user
func (s *Store) ListTransactions(ctx context.Context, userID string, limit, offset int) ([]Transaction, error) {
	query := `
		SELECT id, user_id, transaction_type, amount, source_type, source_id, description, metadata, created_at
		FROM deriv_miles_transactions
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`
	
	rows, err := s.pool.Query(ctx, query, userID, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query transactions: %w", err)
	}
	defer rows.Close()
	
	var transactions []Transaction
	for rows.Next() {
		var txn Transaction
		var metadataBytes []byte
		
		err := rows.Scan(
			&txn.ID, &txn.UserID, &txn.TransactionType, &txn.Amount,
			&txn.SourceType, &txn.SourceID, &txn.Description,
			&metadataBytes, &txn.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan transaction: %w", err)
		}
		
		if len(metadataBytes) > 0 {
			if err := json.Unmarshal(metadataBytes, &txn.Metadata); err != nil {
				return nil, fmt.Errorf("unmarshal metadata: %w", err)
			}
		}
		
		transactions = append(transactions, txn)
	}
	
	return transactions, nil
}

// GetCatalogItem retrieves a catalog item by ID
func (s *Store) GetCatalogItem(ctx context.Context, itemID string) (*CatalogItem, error) {
	query := `
		SELECT id, category, name, description, miles_cost, stock_quantity, available, metadata, image_url, sort_order, created_at, updated_at
		FROM deriv_miles_catalog
		WHERE id = $1
	`
	
	var item CatalogItem
	var metadataBytes []byte
	
	err := s.pool.QueryRow(ctx, query, itemID).Scan(
		&item.ID, &item.Category, &item.Name, &item.Description,
		&item.MilesCost, &item.StockQuantity, &item.Available,
		&metadataBytes, &item.ImageURL, &item.SortOrder,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get catalog item: %w", err)
	}
	
	if len(metadataBytes) > 0 {
		if err := json.Unmarshal(metadataBytes, &item.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}
	
	return &item, nil
}

// ListCatalogItems retrieves catalog items with optional category filter
func (s *Store) ListCatalogItems(ctx context.Context, category string, availableOnly bool) ([]CatalogItem, error) {
	query := `
		SELECT id, category, name, description, miles_cost, stock_quantity, available, metadata, image_url, sort_order, created_at, updated_at
		FROM deriv_miles_catalog
		WHERE ($1 = '' OR category = $1)
		AND ($2 = false OR available = true)
		ORDER BY sort_order ASC, name ASC
	`
	
	rows, err := s.pool.Query(ctx, query, category, availableOnly)
	if err != nil {
		return nil, fmt.Errorf("query catalog items: %w", err)
	}
	defer rows.Close()
	
	var items []CatalogItem
	for rows.Next() {
		var item CatalogItem
		var metadataBytes []byte
		
		err := rows.Scan(
			&item.ID, &item.Category, &item.Name, &item.Description,
			&item.MilesCost, &item.StockQuantity, &item.Available,
			&metadataBytes, &item.ImageURL, &item.SortOrder,
			&item.CreatedAt, &item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan catalog item: %w", err)
		}
		
		if len(metadataBytes) > 0 {
			if err := json.Unmarshal(metadataBytes, &item.Metadata); err != nil {
				return nil, fmt.Errorf("unmarshal metadata: %w", err)
			}
		}
		
		items = append(items, item)
	}
	
	return items, nil
}

// CreateRedemption creates a new redemption record
func (s *Store) CreateRedemption(ctx context.Context, userID, itemID string, milesCost decimal.Decimal, redemptionType string) (*Redemption, error) {
	redemptionID := uuid.New()
	query := `
		INSERT INTO deriv_miles_redemptions (id, user_id, redemption_type, item_id, miles_cost, status)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, user_id, redemption_type, item_id, miles_cost, status, fulfillment_data, expires_at, created_at, fulfilled_at
	`
	
	var redemption Redemption
	var fulfillmentBytes []byte
	
	err := s.pool.QueryRow(ctx, query, redemptionID, userID, redemptionType, itemID, milesCost, RedemptionStatusPending).Scan(
		&redemption.ID, &redemption.UserID, &redemption.RedemptionType,
		&redemption.ItemID, &redemption.MilesCost, &redemption.Status,
		&fulfillmentBytes, &redemption.ExpiresAt, &redemption.CreatedAt, &redemption.FulfilledAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create redemption: %w", err)
	}
	
	if len(fulfillmentBytes) > 0 {
		if err := json.Unmarshal(fulfillmentBytes, &redemption.FulfillmentData); err != nil {
			return nil, fmt.Errorf("unmarshal fulfillment data: %w", err)
		}
	}
	
	return &redemption, nil
}

// UpdateRedemptionStatus updates the status and fulfillment data of a redemption
func (s *Store) UpdateRedemptionStatus(ctx context.Context, redemptionID uuid.UUID, status string, fulfillmentData map[string]interface{}, expiresAt *time.Time) error {
	fulfillmentJSON, err := json.Marshal(fulfillmentData)
	if err != nil {
		return fmt.Errorf("marshal fulfillment data: %w", err)
	}
	
	query := `
		UPDATE deriv_miles_redemptions SET
			status = $2,
			fulfillment_data = $3,
			expires_at = $4,
			fulfilled_at = CASE WHEN $2 = 'fulfilled' THEN NOW() ELSE fulfilled_at END
		WHERE id = $1
	`
	
	_, err = s.pool.Exec(ctx, query, redemptionID, status, fulfillmentJSON, expiresAt)
	if err != nil {
		return fmt.Errorf("update redemption status: %w", err)
	}
	
	return nil
}

// ListRedemptions retrieves redemption history for a user
func (s *Store) ListRedemptions(ctx context.Context, userID, status string, limit, offset int) ([]Redemption, error) {
	query := `
		SELECT id, user_id, redemption_type, item_id, miles_cost, status, fulfillment_data, expires_at, created_at, fulfilled_at
		FROM deriv_miles_redemptions
		WHERE user_id = $1
		AND ($2 = '' OR status = $2)
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`
	
	rows, err := s.pool.Query(ctx, query, userID, status, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("query redemptions: %w", err)
	}
	defer rows.Close()
	
	var redemptions []Redemption
	for rows.Next() {
		var redemption Redemption
		var fulfillmentBytes []byte
		
		err := rows.Scan(
			&redemption.ID, &redemption.UserID, &redemption.RedemptionType,
			&redemption.ItemID, &redemption.MilesCost, &redemption.Status,
			&fulfillmentBytes, &redemption.ExpiresAt, &redemption.CreatedAt, &redemption.FulfilledAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan redemption: %w", err)
		}
		
		if len(fulfillmentBytes) > 0 {
			if err := json.Unmarshal(fulfillmentBytes, &redemption.FulfillmentData); err != nil {
				return nil, fmt.Errorf("unmarshal fulfillment data: %w", err)
			}
		}
		
		redemptions = append(redemptions, redemption)
	}
	
	return redemptions, nil
}

// CreateCatalogItem creates a new catalog item
func (s *Store) CreateCatalogItem(ctx context.Context, req CreateCatalogItemRequest) (*CatalogItem, error) {
	metadataJSON, err := json.Marshal(req.Metadata)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}
	
	query := `
		INSERT INTO deriv_miles_catalog (id, category, name, description, miles_cost, stock_quantity, available, metadata, image_url, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, category, name, description, miles_cost, stock_quantity, available, metadata, image_url, sort_order, created_at, updated_at
	`
	
	var item CatalogItem
	var metadataBytes []byte
	
	err = s.pool.QueryRow(ctx, query,
		req.ID, req.Category, req.Name, req.Description, req.MilesCost,
		req.StockQuantity, req.Available, metadataJSON, req.ImageURL, req.SortOrder,
	).Scan(
		&item.ID, &item.Category, &item.Name, &item.Description,
		&item.MilesCost, &item.StockQuantity, &item.Available,
		&metadataBytes, &item.ImageURL, &item.SortOrder,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert catalog item: %w", err)
	}
	
	if len(metadataBytes) > 0 {
		if err := json.Unmarshal(metadataBytes, &item.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}
	
	return &item, nil
}

// UpdateCatalogItem updates an existing catalog item
func (s *Store) UpdateCatalogItem(ctx context.Context, itemID string, req UpdateCatalogItemRequest) (*CatalogItem, error) {
	updateFields := make([]string, 0)
	args := make([]interface{}, 0)
	argCounter := 1
	
	if req.Name != nil {
		updateFields = append(updateFields, fmt.Sprintf("name = $%d", argCounter))
		args = append(args, *req.Name)
		argCounter++
	}
	if req.Description != nil {
		updateFields = append(updateFields, fmt.Sprintf("description = $%d", argCounter))
		args = append(args, *req.Description)
		argCounter++
	}
	if req.MilesCost != nil {
		updateFields = append(updateFields, fmt.Sprintf("miles_cost = $%d", argCounter))
		args = append(args, *req.MilesCost)
		argCounter++
	}
	if req.StockQuantity != nil {
		updateFields = append(updateFields, fmt.Sprintf("stock_quantity = $%d", argCounter))
		args = append(args, *req.StockQuantity)
		argCounter++
	}
	if req.Available != nil {
		updateFields = append(updateFields, fmt.Sprintf("available = $%d", argCounter))
		args = append(args, *req.Available)
		argCounter++
	}
	if req.Metadata != nil {
		metadataJSON, err := json.Marshal(*req.Metadata)
		if err != nil {
			return nil, fmt.Errorf("marshal metadata: %w", err)
		}
		updateFields = append(updateFields, fmt.Sprintf("metadata = $%d", argCounter))
		args = append(args, metadataJSON)
		argCounter++
	}
	if req.ImageURL != nil {
		updateFields = append(updateFields, fmt.Sprintf("image_url = $%d", argCounter))
		args = append(args, *req.ImageURL)
		argCounter++
	}
	if req.SortOrder != nil {
		updateFields = append(updateFields, fmt.Sprintf("sort_order = $%d", argCounter))
		args = append(args, *req.SortOrder)
		argCounter++
	}
	
	if len(updateFields) == 0 {
		return s.GetCatalogItem(ctx, itemID)
	}
	
	updateFields = append(updateFields, "updated_at = NOW()")
	args = append(args, itemID)
	
	query := fmt.Sprintf(`
		UPDATE deriv_miles_catalog SET %s
		WHERE id = $%d
		RETURNING id, category, name, description, miles_cost, stock_quantity, available, metadata, image_url, sort_order, created_at, updated_at
	`, fmt.Sprintf("%s", updateFields), argCounter)
	
	var item CatalogItem
	var metadataBytes []byte
	
	err := s.pool.QueryRow(ctx, query, args...).Scan(
		&item.ID, &item.Category, &item.Name, &item.Description,
		&item.MilesCost, &item.StockQuantity, &item.Available,
		&metadataBytes, &item.ImageURL, &item.SortOrder,
		&item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update catalog item: %w", err)
	}
	
	if len(metadataBytes) > 0 {
		if err := json.Unmarshal(metadataBytes, &item.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal metadata: %w", err)
		}
	}
	
	return &item, nil
}

// GetEarningRules retrieves all active earning rules
func (s *Store) GetEarningRules(ctx context.Context) ([]EarningRule, error) {
	query := `
		SELECT id, rule_type, miles_formula, conditions, active, priority, description, created_at, updated_at
		FROM deriv_miles_earning_rules
		WHERE active = true
		ORDER BY priority ASC
	`
	
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query earning rules: %w", err)
	}
	defer rows.Close()
	
	var rules []EarningRule
	for rows.Next() {
		var rule EarningRule
		var conditionsBytes []byte
		
		err := rows.Scan(
			&rule.ID, &rule.RuleType, &rule.MilesFormula,
			&conditionsBytes, &rule.Active, &rule.Priority,
			&rule.Description, &rule.CreatedAt, &rule.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan earning rule: %w", err)
		}
		
		if len(conditionsBytes) > 0 {
			if err := json.Unmarshal(conditionsBytes, &rule.Conditions); err != nil {
				return nil, fmt.Errorf("unmarshal conditions: %w", err)
			}
		}
		
		rules = append(rules, rule)
	}
	
	return rules, nil
}
