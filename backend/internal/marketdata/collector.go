package marketdata

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"go.uber.org/zap"
)

// PublicSource is implemented by adapters (e.g. Deriv public WS) for phased collection.
type PublicSource interface {
	Name() string
	// Core: live tickers for canonical pairs
	GetTickers(ctx context.Context, canonicalMarkets []string) ([]Ticker, error)
	// Optional: candles for one pair (skipped if limit <= 0)
	GetCandles(ctx context.Context, market string, interval Interval, limit int) ([]Candle, error)
	// Optional: symbol discovery
	GetMarkets(ctx context.Context) ([]MarketInfo, error)
}

// Collector aggregates multiple phases and records partial failures.
type Collector struct {
	log    *zap.Logger
	source PublicSource
}

// NewCollector builds a market data collector around a single primary source (Deriv public).
// Additional sources can be composed later via a fan-in PublicSource implementation.
func NewCollector(log *zap.Logger, source PublicSource) *Collector {
	return &Collector{log: log.Named("marketdata"), source: source}
}

// Collect runs phase 1 (tickers, parallel-ready) then optional phase 2 (candles per symbol, markets list).
func (c *Collector) Collect(ctx context.Context, opts CollectOptions) (*MarketSnapshot, error) {
	if c.source == nil {
		return nil, fmt.Errorf("marketdata: no source configured")
	}
	start := time.Now()
	meta := SnapshotMeta{
		SuccessItems: []string{},
		FailedItems:  []string{},
		SourceMeta:   []SourceMeta{},
	}
	snap := &MarketSnapshot{
		CollectedAt: start,
		Candles:     make(map[string][]Candle),
		Meta:        meta,
	}

	// Phase 1 — core tickers
	t0 := time.Now()
	tickers, err := c.source.GetTickers(ctx, opts.CanonicalMarkets)
	srcMeta := SourceMeta{Source: c.source.Name(), Phase: string(PhaseCore), OK: err == nil, Duration: time.Since(t0)}
	if err != nil {
		srcMeta.Error = err.Error()
		snap.Meta.FailedItems = append(snap.Meta.FailedItems, "tickers")
		c.log.Warn("collector: tickers failed", zap.Error(err))
	} else {
		snap.Tickers = tickers
		snap.Meta.SuccessItems = append(snap.Meta.SuccessItems, "tickers")
	}
	snap.Meta.SourceMeta = append(snap.Meta.SourceMeta, srcMeta)

	// Phase 2 — enrichment (best-effort)
	if opts.CandleMarket != "" && opts.CandleLimit > 0 {
		t1 := time.Now()
		iv := opts.CandleInterval
		if iv == "" {
			iv = Interval1m
		}
		candles, err2 := c.source.GetCandles(ctx, opts.CandleMarket, iv, opts.CandleLimit)
		m2 := SourceMeta{Source: c.source.Name(), Phase: string(PhaseEnrichment), OK: err2 == nil, Duration: time.Since(t1)}
		if err2 != nil {
			m2.Error = err2.Error()
			snap.Meta.FailedItems = append(snap.Meta.FailedItems, "candles:"+opts.CandleMarket)
			c.log.Warn("collector: candles failed", zap.String("market", opts.CandleMarket), zap.Error(err2))
		} else {
			snap.Candles[opts.CandleMarket] = candles
			snap.Meta.SuccessItems = append(snap.Meta.SuccessItems, "candles")
		}
		snap.Meta.SourceMeta = append(snap.Meta.SourceMeta, m2)
	}

	if opts.IncludeMarkets {
		t2 := time.Now()
		mkts, err3 := c.source.GetMarkets(ctx)
		m3 := SourceMeta{Source: c.source.Name(), Phase: string(PhaseEnrichment), OK: err3 == nil, Duration: time.Since(t2)}
		if err3 != nil {
			m3.Error = err3.Error()
			snap.Meta.FailedItems = append(snap.Meta.FailedItems, "markets")
			c.log.Warn("collector: markets list failed", zap.Error(err3))
		} else {
			snap.Markets = mkts
			snap.Meta.SuccessItems = append(snap.Meta.SuccessItems, "markets")
		}
		snap.Meta.SourceMeta = append(snap.Meta.SourceMeta, m3)
	}

	snap.Meta.TotalDuration = time.Since(start)
	return snap, nil
}

// CollectOptions configures one collection round.
type CollectOptions struct {
	CanonicalMarkets []string
	CandleMarket     string
	CandleInterval   Interval
	CandleLimit      int
	IncludeMarkets   bool
}

// ParseCanonicalMarkets splits a comma-separated env list into trimmed non-empty strings.
func ParseCanonicalMarkets(s string) []string {
	if strings.TrimSpace(s) == "" {
		return []string{"VOL100-USD"}
	}
	var out []string
	for _, p := range strings.Split(s, ",") {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"VOL100-USD"}
	}
	return out
}

// BackgroundRunner periodically collects and dispatches snapshots (via callback).
type BackgroundRunner struct {
	log       *zap.Logger
	collector *Collector
	interval  time.Duration
	onCollect func(context.Context, *MarketSnapshot)
	mu        sync.Mutex
	cancel    context.CancelFunc
}

// NewBackgroundRunner creates a runner; onCollect may push to actionbus or no-op.
func NewBackgroundRunner(log *zap.Logger, collector *Collector, interval time.Duration, onCollect func(context.Context, *MarketSnapshot)) *BackgroundRunner {
	if interval < 2*time.Second {
		interval = 5 * time.Second
	}
	return &BackgroundRunner{
		log:       log.Named("marketdata_runner"),
		collector: collector,
		interval:  interval,
		onCollect: onCollect,
	}
}

// Start begins the ticker loop until parent ctx is done.
func (r *BackgroundRunner) Start(ctx context.Context, opts CollectOptions) {
	ctx2, cancel := context.WithCancel(ctx)
	r.mu.Lock()
	r.cancel = cancel
	r.mu.Unlock()

	t := time.NewTicker(r.interval)
	defer t.Stop()

	runOnce := func() {
		cctx, cancel := context.WithTimeout(ctx2, 20*time.Second)
		defer cancel()
		snap, err := r.collector.Collect(cctx, opts)
		if err != nil {
			r.log.Warn("collect round failed", zap.Error(err))
			return
		}
		if r.onCollect != nil {
			r.onCollect(cctx, snap)
		}
	}
	runOnce()
	for {
		select {
		case <-ctx2.Done():
			return
		case <-t.C:
			runOnce()
		}
	}
}

// Stop cancels the inner context if Start was used with a derived cancel.
func (r *BackgroundRunner) Stop() {
	r.mu.Lock()
	if r.cancel != nil {
		r.cancel()
	}
	r.mu.Unlock()
}
