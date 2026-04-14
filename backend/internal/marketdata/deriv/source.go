package deriv

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/shopspring/decimal"
	"go.uber.org/zap"

	"derivarena/internal/derivcontract"
	"derivarena/internal/marketdata"
)

const (
	publicWSURL = "wss://api.derivws.com/trading/v1/options/ws/public"
)

// Source implements marketdata.PublicSource using Deriv's public WebSocket API.
type Source struct {
	log *zap.Logger

	ctx    context.Context
	cancel context.CancelFunc

	mu           sync.RWMutex
	conn         *websocket.Conn
	lastPrices   map[string]marketdata.Ticker
	reqID        int
	responseCh   map[int]chan map[string]interface{}
	subscribed   map[string]struct{} // Deriv symbol strings
}

// NewSource creates a Deriv public market data source and starts the read/reconnect loop.
func NewSource(log *zap.Logger) *Source {
	ctx, cancel := context.WithCancel(context.Background())
	s := &Source{
		log:        log,
		ctx:        ctx,
		cancel:     cancel,
		lastPrices: make(map[string]marketdata.Ticker),
		responseCh: make(map[int]chan map[string]interface{}),
		subscribed: make(map[string]struct{}),
	}
	go s.runForever()
	return s
}

func (s *Source) Name() string { return "deriv_public_ws" }

func (s *Source) runForever() {
	backoff := time.Second
	const maxBackoff = 30 * time.Second
	for {
		if s.ctx.Err() != nil {
			return
		}
		if err := s.connectOnce(); err != nil {
			s.log.Error("Deriv public WS connect failed", zap.Error(err))
			if !sleepCtx(s.ctx, s.jitter(backoff)) {
				return
			}
			if backoff < maxBackoff {
				backoff *= 2
			}
			continue
		}
		backoff = time.Second
		s.replaySubscriptions()
		s.readLoopUntilError()
		s.closeConn()
		s.log.Warn("Deriv public WS disconnected; reconnecting")
		if !sleepCtx(s.ctx, s.jitter(backoff)) {
			return
		}
		if backoff < maxBackoff {
			backoff *= 2
		}
	}
}

func sleepCtx(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		select {
		case <-ctx.Done():
			return false
		default:
			return true
		}
	}
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-t.C:
		return true
	}
}

func (s *Source) jitter(d time.Duration) time.Duration {
	if d <= 0 {
		return d
	}
	j := time.Duration(rand.Int63n(int64(d / 5)))
	return d + j
}

func (s *Source) connectOnce() error {
	dialer := websocket.Dialer{HandshakeTimeout: 15 * time.Second}
	conn, _, err := dialer.Dial(publicWSURL, nil)
	if err != nil {
		return fmt.Errorf("dial: %w", err)
	}
	s.mu.Lock()
	s.conn = conn
	s.mu.Unlock()
	s.log.Info("Deriv public WebSocket connected")
	return nil
}

func (s *Source) closeConn() {
	s.mu.Lock()
	if s.conn != nil {
		_ = s.conn.Close()
		s.conn = nil
	}
	s.mu.Unlock()
}

func (s *Source) replaySubscriptions() {
	s.mu.RLock()
	syms := make([]string, 0, len(s.subscribed))
	for sym := range s.subscribed {
		syms = append(syms, sym)
	}
	s.mu.RUnlock()
	for _, sym := range syms {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		_, _ = s.sendRequest(ctx, map[string]interface{}{"ticks": sym})
		cancel()
	}
}

func (s *Source) readLoopUntilError() {
	for {
		s.mu.RLock()
		c := s.conn
		s.mu.RUnlock()
		if c == nil {
			return
		}
		_, msg, err := c.ReadMessage()
		if err != nil {
			s.log.Error("Deriv WS read error", zap.Error(err))
			return
		}

		var resp map[string]interface{}
		if err := json.Unmarshal(msg, &resp); err != nil {
			continue
		}

		if reqIDFloat, ok := resp["req_id"].(float64); ok {
			reqID := int(reqIDFloat)
			s.mu.Lock()
			if ch, exists := s.responseCh[reqID]; exists {
				select {
				case ch <- resp:
				default:
				}
			}
			s.mu.Unlock()
		}

		if tick, ok := resp["tick"].(map[string]interface{}); ok {
			s.processTick(tick)
		}
	}
}

func (s *Source) processTick(tick map[string]interface{}) {
	symbol, _ := tick["symbol"].(string)
	quote, ok := tick["quote"].(float64)
	if symbol == "" || !ok {
		return
	}
	canonical := derivcontract.DerivToCanonical(symbol)
	q := decimal.NewFromFloat(quote)

	s.mu.Lock()
	s.lastPrices[canonical] = marketdata.Ticker{
		Market:    canonical,
		Last:      q,
		Bid:       q,
		Ask:       q,
		Timestamp: time.Now().UTC(),
	}
	s.mu.Unlock()
}

func (s *Source) sendRequest(ctx context.Context, payload map[string]interface{}) (map[string]interface{}, error) {
	s.mu.Lock()
	s.reqID++
	reqID := s.reqID
	payload["req_id"] = reqID
	conn := s.conn
	s.mu.Unlock()

	if conn == nil {
		return nil, fmt.Errorf("deriv: no connection")
	}

	ch := make(chan map[string]interface{}, 1)
	s.mu.Lock()
	s.responseCh[reqID] = ch
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.responseCh, reqID)
		close(ch)
		s.mu.Unlock()
	}()

	data, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	s.mu.RLock()
	conn = s.conn
	s.mu.RUnlock()
	if conn == nil {
		return nil, fmt.Errorf("deriv: connection closed")
	}
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		return nil, fmt.Errorf("send: %w", err)
	}

	deadline := time.NewTimer(12 * time.Second)
	defer deadline.Stop()
	select {
	case resp := <-ch:
		if errObj, ok := resp["error"].(map[string]interface{}); ok {
			return nil, fmt.Errorf("deriv api error: %v", errObj)
		}
		return resp, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-deadline.C:
		return nil, fmt.Errorf("timeout (req_id=%d)", reqID)
	}
}

// GetTickers implements marketdata.PublicSource.
func (s *Source) GetTickers(ctx context.Context, markets []string) ([]marketdata.Ticker, error) {
	if len(markets) == 0 {
		return nil, fmt.Errorf("deriv: no markets requested")
	}
	for _, m := range markets {
		derivSym, err := derivcontract.CanonicalToDeriv(m)
		if err != nil {
			return nil, err
		}
		s.mu.Lock()
		s.subscribed[derivSym] = struct{}{}
		s.mu.Unlock()
		_, _ = s.sendRequest(ctx, map[string]interface{}{"ticks": derivSym})
	}

	deadline := time.Now().Add(3 * time.Second)
	var out []marketdata.Ticker
	for time.Now().Before(deadline) {
		s.mu.RLock()
		allOK := true
		out = out[:0]
		for _, m := range markets {
			if t, ok := s.lastPrices[m]; ok {
				out = append(out, t)
			} else {
				allOK = false
				break
			}
		}
		s.mu.RUnlock()
		if allOK && len(out) == len(markets) {
			return out, nil
		}
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(100 * time.Millisecond):
		}
	}
	return nil, fmt.Errorf("deriv: no ticker data available for markets")
}

// GetCandles implements marketdata.PublicSource.
func (s *Source) GetCandles(ctx context.Context, market string, interval marketdata.Interval, limit int) ([]marketdata.Candle, error) {
	if limit <= 0 {
		return nil, nil
	}
	derivSymbol, err := derivcontract.CanonicalToDeriv(market)
	if err != nil {
		return nil, err
	}

	granularity := 60
	switch interval {
	case marketdata.Interval1m:
		granularity = 60
	case marketdata.Interval5m:
		granularity = 300
	case marketdata.Interval15m:
		granularity = 900
	case marketdata.Interval1h:
		granularity = 3600
	case marketdata.Interval4h:
		granularity = 14400
	case marketdata.Interval1d:
		granularity = 86400
	}

	endTime := time.Now().Unix()
	startTime := endTime - int64(limit*granularity)

	payload := map[string]interface{}{
		"ticks_history": derivSymbol,
		"start":         startTime,
		"end":           endTime,
		"granularity":   granularity,
		"style":         "candles",
	}

	resp, err := s.sendRequest(ctx, payload)
	if err != nil {
		return nil, fmt.Errorf("get candles: %w", err)
	}

	candlesData, ok := resp["candles"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("no candles in response")
	}

	var candles []marketdata.Candle
	for _, c := range candlesData {
		candleMap, ok := c.(map[string]interface{})
		if !ok {
			continue
		}
		epoch, _ := candleMap["epoch"].(float64)
		open, _ := candleMap["open"].(float64)
		high, _ := candleMap["high"].(float64)
		low, _ := candleMap["low"].(float64)
		close, _ := candleMap["close"].(float64)

		candles = append(candles, marketdata.Candle{
			Timestamp: time.Unix(int64(epoch), 0).UTC(),
			Open:      decimal.NewFromFloat(open),
			High:      decimal.NewFromFloat(high),
			Low:       decimal.NewFromFloat(low),
			Close:     decimal.NewFromFloat(close),
			Volume:    decimal.Zero,
		})
	}
	return candles, nil
}

// GetMarkets implements marketdata.PublicSource.
func (s *Source) GetMarkets(ctx context.Context) ([]marketdata.MarketInfo, error) {
	payload := map[string]interface{}{
		"active_symbols": "brief",
		"product_type":   "basic",
	}
	resp, err := s.sendRequest(ctx, payload)
	if err != nil {
		return nil, fmt.Errorf("get active_symbols: %w", err)
	}

	symbols, ok := resp["active_symbols"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("no active_symbols in response")
	}

	var markets []marketdata.MarketInfo
	for _, sym := range symbols {
		symMap, ok := sym.(map[string]interface{})
		if !ok {
			continue
		}
		symbol, _ := symMap["symbol"].(string)
		mkt, _ := symMap["market"].(string)
		if symbol == "" {
			continue
		}
		canonical := derivcontract.DerivToCanonical(symbol)
		markets = append(markets, marketdata.MarketInfo{
			Pair:      canonical,
			Base:      mkt,
			Quote:     "USD",
			Tradeable: true,
		})
	}
	return markets, nil
}

// Close stops the background loop and closes the connection.
func (s *Source) Close() {
	s.cancel()
	s.closeConn()
}
