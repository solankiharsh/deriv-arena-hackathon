package exchange

import (
	"sync"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// SimClient is a minimal in-memory exchange stub for local development and tests.
type SimClient struct {
	log            *zap.Logger
	commissionRate decimal.Decimal
	mu             sync.RWMutex
	prices         map[string]decimal.Decimal
}

// NewSimClient returns a simulated exchange client.
func NewSimClient(log *zap.Logger, commissionRate decimal.Decimal) *SimClient {
	if log == nil {
		log = zap.NewNop()
	}
	return &SimClient{
		log:            log,
		commissionRate: commissionRate,
		prices:         map[string]decimal.Decimal{"VOL100-USD": decimal.NewFromInt(10000)},
	}
}

// SubmitTrade records a synthetic fill at the last known or default price.
func (s *SimClient) SubmitTrade(req *TradeRequest) (*TradeResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	price, ok := s.prices[req.Pair]
	if !ok || price.IsZero() {
		price = decimal.NewFromInt(10000)
	}
	fee := price.Mul(s.commissionRate)
	return &TradeResponse{
		FillID:   "sim_1",
		Status:   StatusFilled,
		Price:    price,
		Qty:      decimal.NewFromInt(1),
		QuoteQty: price,
		Fee:      fee,
		Pair:     req.Pair,
		Side:     req.Side,
	}, nil
}

// GetPrice returns last simulated price for the pair.
func (s *SimClient) GetPrice(pair string) (decimal.Decimal, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.prices[pair]
	return p, ok
}

// GetPrices returns all cached prices.
func (s *SimClient) GetPrices() map[string]decimal.Decimal {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]decimal.Decimal, len(s.prices))
	for k, v := range s.prices {
		out[k] = v
	}
	return out
}
