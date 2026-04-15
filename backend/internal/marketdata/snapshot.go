package marketdata

import (
	"time"
)

// CollectPhase identifies which phase produced data (for partial-success metadata).
type CollectPhase string

const (
	PhaseCore       CollectPhase = "core"
	PhaseEnrichment CollectPhase = "enrichment"
)

// SourceMeta records per-source success/failure for one collection round.
type SourceMeta struct {
	Source   string    `json:"source"`
	Phase    string    `json:"phase"`
	OK       bool      `json:"ok"`
	Error    string    `json:"error,omitempty"`
	Duration time.Duration `json:"duration_ms,omitempty"`
}

// MarketSnapshot is the canonical bundle after normalization (extend with news, coach context, etc.).
type MarketSnapshot struct {
	CollectedAt time.Time         `json:"collected_at"`
	Tickers     []Ticker          `json:"tickers"`
	Candles     map[string][]Candle `json:"candles,omitempty"` // key: canonical pair
	Markets     []MarketInfo      `json:"markets,omitempty"`
	Meta        SnapshotMeta      `json:"meta"`
}

// SnapshotMeta aggregates partial-success and timing across sources.
type SnapshotMeta struct {
	SuccessItems []string      `json:"success_items"`
	FailedItems  []string      `json:"failed_items"`
	SourceMeta   []SourceMeta  `json:"source_details"`
	TotalDuration time.Duration `json:"total_duration,omitempty"`
}
