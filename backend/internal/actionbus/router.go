package actionbus

import (
	"context"
	"sync"

	"go.uber.org/zap"

	"derivarena/internal/marketdata"
)

// SignalKind categorizes post-ingestion events for handlers.
type SignalKind string

const (
	SignalMarketSnapshot SignalKind = "market_snapshot"
	SignalTick           SignalKind = "tick"
)

// ActionSignal is a normalized event for downstream modules (leaderboard refresh, nudges, coach).
type ActionSignal struct {
	Kind    SignalKind             `json:"kind"`
	Snapshot *marketdata.MarketSnapshot `json:"snapshot,omitempty"`
}

// Handler processes one signal type.
type Handler func(ctx context.Context, sig ActionSignal) error

// Router dispatches signals to registered handlers (fan-out).
type Router struct {
	log       *zap.Logger
	mu        sync.RWMutex
	handlers  map[SignalKind][]Handler
}

// NewRouter creates an empty router.
func NewRouter(log *zap.Logger) *Router {
	return &Router{
		log:      log.Named("actionbus"),
		handlers: make(map[SignalKind][]Handler),
	}
}

// Register adds a handler for a kind (idempotent ordering: append).
func (r *Router) Register(kind SignalKind, h Handler) {
	if h == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[kind] = append(r.handlers[kind], h)
}

// Dispatch invokes all handlers for the signal's kind; errors are logged, not aggregated.
func (r *Router) Dispatch(ctx context.Context, sig ActionSignal) {
	r.mu.RLock()
	list := append([]Handler(nil), r.handlers[sig.Kind]...)
	r.mu.RUnlock()
	for _, h := range list {
		if err := h(ctx, sig); err != nil {
			r.log.Warn("handler error", zap.String("kind", string(sig.Kind)), zap.Error(err))
		}
	}
}

// DispatchSnapshot is a convenience for market_snapshot signals.
func (r *Router) DispatchSnapshot(ctx context.Context, snap *marketdata.MarketSnapshot) {
	r.Dispatch(ctx, ActionSignal{Kind: SignalMarketSnapshot, Snapshot: snap})
}
