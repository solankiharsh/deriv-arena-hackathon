package derivmiles

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// Service handles Deriv Miles HTTP endpoints
type Service struct {
	log       *zap.Logger
	store     *Store
	engine    *EarningEngine
	processor *RedemptionProcessor
	catalog   *CatalogManager
}

// NewService creates a new Deriv Miles service
func NewService(log *zap.Logger, pool *pgxpool.Pool) *Service {
	store := NewStore(pool)
	engine := NewEarningEngine(store)
	processor := NewRedemptionProcessor(store, engine)
	catalog := NewCatalogManager(store)
	
	return &Service{
		log:       log,
		store:     store,
		engine:    engine,
		processor: processor,
		catalog:   catalog,
	}
}

// GetEngine returns the earning engine for integration with other services
func (s *Service) GetEngine() *EarningEngine {
	return s.engine
}

// RegisterRoutes registers HTTP handlers on the given router
func (s *Service) RegisterRoutes(r chi.Router) {
	r.Route("/api/miles", func(r chi.Router) {
		r.Get("/balance", s.handleGetBalance)
		r.Get("/stats", s.handleGetStats)
		r.Get("/transactions", s.handleListTransactions)
		r.Get("/earning-opportunities", s.handleEarningOpportunities)
		
		r.Get("/catalog", s.handleListCatalog)
		r.Get("/catalog/{id}", s.handleGetCatalogItem)
		r.Get("/catalog/featured", s.handleFeaturedItems)
		r.Get("/catalog/recommendations", s.handleRecommendations)
		
		r.Post("/redeem", s.handleRedeem)
		r.Get("/redemptions", s.handleListRedemptions)
		r.Get("/redemptions/{id}", s.handleGetRedemption)
		
		r.Get("/premium-features", s.handleGetPremiumFeatures)
		r.Get("/marketplace-items", s.handleGetMarketplaceItems)
		r.Get("/trading-benefits", s.handleGetTradingBenefits)
	})
	
	r.Route("/api/admin/miles", func(r chi.Router) {
		r.Post("/award", s.handleAdminAward)
		r.Post("/catalog", s.handleAdminCreateCatalogItem)
		r.Patch("/catalog/{id}", s.handleAdminUpdateCatalogItem)
		r.Get("/analytics", s.handleAdminAnalytics)
	})
}

// handleGetBalance gets the user's miles balance
func (s *Service) handleGetBalance(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	balance, err := s.store.GetBalance(r.Context(), userID)
	if err != nil {
		s.log.Error("Failed to get balance", zap.Error(err), zap.String("user_id", userID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(balance)
}

// handleGetStats gets extended balance statistics
func (s *Service) handleGetStats(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	stats, err := s.store.GetBalanceStats(r.Context(), userID)
	if err != nil {
		s.log.Error("Failed to get stats", zap.Error(err), zap.String("user_id", userID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// handleListTransactions lists transaction history
func (s *Service) handleListTransactions(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	
	transactions, err := s.store.ListTransactions(r.Context(), userID, limit, offset)
	if err != nil {
		s.log.Error("Failed to list transactions", zap.Error(err), zap.String("user_id", userID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transactions)
}

// handleEarningOpportunities returns available earning opportunities
func (s *Service) handleEarningOpportunities(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	
	opportunities, err := s.engine.GetEarningOpportunities(r.Context(), userID)
	if err != nil {
		s.log.Error("Failed to get earning opportunities", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(opportunities)
}

// handleListCatalog lists catalog items
func (s *Service) handleListCatalog(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	userID := r.URL.Query().Get("user_id")
	
	items, err := s.catalog.GetCatalogWithPricing(r.Context(), userID, category)
	if err != nil {
		s.log.Error("Failed to list catalog", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// handleGetCatalogItem gets a specific catalog item
func (s *Service) handleGetCatalogItem(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "id")
	
	item, err := s.store.GetCatalogItem(r.Context(), itemID)
	if err != nil {
		s.log.Error("Failed to get catalog item", zap.Error(err), zap.String("item_id", itemID))
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

// handleFeaturedItems returns featured catalog items
func (s *Service) handleFeaturedItems(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 20 {
		limit = 6
	}
	
	items, err := s.catalog.GetFeaturedItems(r.Context(), limit)
	if err != nil {
		s.log.Error("Failed to get featured items", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// handleRecommendations returns personalized recommendations
func (s *Service) handleRecommendations(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 20 {
		limit = 5
	}
	
	items, err := s.catalog.GetRecommendations(r.Context(), userID, limit)
	if err != nil {
		s.log.Error("Failed to get recommendations", zap.Error(err), zap.String("user_id", userID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// handleRedeem processes a redemption request
func (s *Service) handleRedeem(w http.ResponseWriter, r *http.Request) {
	var req struct {
		UserID   string                 `json:"user_id"`
		ItemID   string                 `json:"item_id"`
		Quantity int                    `json:"quantity"`
		Metadata map[string]interface{} `json:"metadata"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("decode request: %v", err), http.StatusBadRequest)
		return
	}
	
	if req.UserID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	if req.ItemID == "" {
		http.Error(w, "item_id required", http.StatusBadRequest)
		return
	}
	
	if req.Quantity <= 0 {
		req.Quantity = 1
	}
	
	redeemReq := RedeemRequest{
		ItemID:   req.ItemID,
		Quantity: req.Quantity,
		Metadata: req.Metadata,
	}
	
	redemption, err := s.processor.ProcessRedemption(r.Context(), req.UserID, redeemReq)
	if err != nil {
		s.log.Error("Failed to process redemption", zap.Error(err), zap.String("user_id", req.UserID), zap.String("item_id", req.ItemID))
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	s.log.Info("Redemption processed", 
		zap.String("user_id", req.UserID),
		zap.String("item_id", req.ItemID),
		zap.String("redemption_id", redemption.ID.String()),
	)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(redemption)
}

// handleListRedemptions lists user's redemption history
func (s *Service) handleListRedemptions(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	status := r.URL.Query().Get("status")
	
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	
	redemptions, err := s.store.ListRedemptions(r.Context(), userID, status, limit, offset)
	if err != nil {
		s.log.Error("Failed to list redemptions", zap.Error(err), zap.String("user_id", userID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(redemptions)
}

// handleGetRedemption gets a specific redemption
func (s *Service) handleGetRedemption(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid id", http.StatusBadRequest)
		return
	}
	
	details, err := s.processor.GetRedemptionDetails(r.Context(), id)
	if err != nil {
		s.log.Error("Failed to get redemption", zap.Error(err), zap.String("id", idStr))
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(details)
}

// handleGetPremiumFeatures gets active premium features for a user
func (s *Service) handleGetPremiumFeatures(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	features, err := s.processor.GetUserPremiumFeatures(r.Context(), userID)
	if err != nil {
		s.log.Error("Failed to get premium features", zap.Error(err), zap.String("user_id", userID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(features)
}

// handleGetMarketplaceItems gets owned marketplace items for a user
func (s *Service) handleGetMarketplaceItems(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	items, err := s.processor.GetUserMarketplaceItems(r.Context(), userID)
	if err != nil {
		s.log.Error("Failed to get marketplace items", zap.Error(err), zap.String("user_id", userID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

// handleGetTradingBenefits gets active trading benefits for a user
func (s *Service) handleGetTradingBenefits(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	benefits, err := s.processor.GetUserTradingBenefits(r.Context(), userID)
	if err != nil {
		s.log.Error("Failed to get trading benefits", zap.Error(err), zap.String("user_id", userID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(benefits)
}

// Admin Endpoints

// handleAdminAward manually awards miles to a user
func (s *Service) handleAdminAward(w http.ResponseWriter, r *http.Request) {
	var req AwardMilesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("decode request: %v", err), http.StatusBadRequest)
		return
	}
	
	if req.UserID == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	
	if req.Amount.LessThanOrEqual(decimal.Zero) {
		http.Error(w, "amount must be positive", http.StatusBadRequest)
		return
	}
	
	if req.Description == "" {
		req.Description = "Manual admin award"
	}
	
	if req.SourceType == "" {
		req.SourceType = SourceTypeManual
	}
	
	sourceID := fmt.Sprintf("admin_award_%s", uuid.New().String()[:8])
	
	transaction, err := s.store.AwardMiles(r.Context(), req.UserID, req.Amount, req.SourceType, sourceID, req.Description, req.Metadata)
	if err != nil {
		s.log.Error("Failed to award miles", zap.Error(err), zap.String("user_id", req.UserID))
		http.Error(w, fmt.Sprintf("failed to award miles: %v", err), http.StatusInternalServerError)
		return
	}
	
	s.log.Info("Admin awarded miles",
		zap.String("user_id", req.UserID),
		zap.String("amount", req.Amount.String()),
	)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(transaction)
}

// handleAdminCreateCatalogItem creates a new catalog item
func (s *Service) handleAdminCreateCatalogItem(w http.ResponseWriter, r *http.Request) {
	var req CreateCatalogItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("decode request: %v", err), http.StatusBadRequest)
		return
	}
	
	if err := s.catalog.ValidateCatalogItem(req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	item, err := s.store.CreateCatalogItem(r.Context(), req)
	if err != nil {
		s.log.Error("Failed to create catalog item", zap.Error(err), zap.String("item_id", req.ID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	s.log.Info("Catalog item created", zap.String("id", item.ID), zap.String("name", item.Name))
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(item)
}

// handleAdminUpdateCatalogItem updates an existing catalog item
func (s *Service) handleAdminUpdateCatalogItem(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "id")
	
	var req UpdateCatalogItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("decode request: %v", err), http.StatusBadRequest)
		return
	}
	
	item, err := s.store.UpdateCatalogItem(r.Context(), itemID, req)
	if err != nil {
		s.log.Error("Failed to update catalog item", zap.Error(err), zap.String("item_id", itemID))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	s.log.Info("Catalog item updated", zap.String("id", item.ID))
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(item)
}

// handleAdminAnalytics returns system-wide analytics
func (s *Service) handleAdminAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	
	catalogStats, err := s.catalog.GetCatalogStats(ctx)
	if err != nil {
		s.log.Error("Failed to get catalog stats", zap.Error(err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	
	analytics := map[string]interface{}{
		"catalog": catalogStats,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analytics)
}

// Helper function to get user ID from context or query (for auth middleware)
func getUserIDFromRequest(r *http.Request) string {
	if userID := r.Context().Value("user_id"); userID != nil {
		if id, ok := userID.(string); ok {
			return id
		}
	}
	
	return r.URL.Query().Get("user_id")
}
