package marketdata

import (
	"time"

	"github.com/shopspring/decimal"
)

// Interval is candle granularity for historical requests.
type Interval string

const (
	Interval1m  Interval = "1m"
	Interval5m  Interval = "5m"
	Interval15m Interval = "15m"
	Interval1h  Interval = "1h"
	Interval4h  Interval = "4h"
	Interval1d  Interval = "1d"
)

// Ticker is a normalized last-quote snapshot for a canonical market pair.
type Ticker struct {
	Market    string
	Last      decimal.Decimal
	Bid       decimal.Decimal
	Ask       decimal.Decimal
	Timestamp time.Time
}

// Candle is OHLCV-style bar (volume may be zero for synthetic).
type Candle struct {
	Timestamp time.Time
	Open      decimal.Decimal
	High      decimal.Decimal
	Low       decimal.Decimal
	Close     decimal.Decimal
	Volume    decimal.Decimal
}

// MarketInfo describes a tradable symbol in canonical form.
type MarketInfo struct {
	Pair      string
	Base      string
	Quote     string
	Tradeable bool
}

// Orderbook is reserved for venues that support depth (not Deriv synthetic).
type Orderbook struct{}

// FundingData is reserved for perp venues.
type FundingData struct{}

// OpenInterest is reserved for venues that publish OI.
type OpenInterest struct{}
