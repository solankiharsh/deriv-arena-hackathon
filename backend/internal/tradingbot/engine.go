package tradingbot

import (
	"context"
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/shopspring/decimal"
	"go.uber.org/zap"
)

// EngineEvent is a real-time update broadcast to WebSocket subscribers.
type EngineEvent struct {
	BotID string      `json:"bot_id"`
	Type  string      `json:"type"` // "trade", "level_up", "analytics", "signal", "status"
	Data  interface{} `json:"data"`
	At    time.Time   `json:"at"`
}

// BotEngine owns all running bot goroutines.
type BotEngine struct {
	store       *Store
	indicators  *IndicatorCalculator
	news        *NewsCollector
	ai          *AIAnalyzer
	processor   *SignalProcessor
	leveling    *LevelingEngine
	marketData  *marketFeed // synthetic candle generator for paper mode
	logger      *zap.Logger

	runners sync.Map // botID -> *botRunner

	subsMu sync.RWMutex
	subs   map[string][]chan EngineEvent // botID -> subscribers
}

type botRunner struct {
	botID    string
	stopCh   chan struct{}
	pauseCh  chan bool // true = pause, false = resume
	paused   bool
	wg       sync.WaitGroup
	dayCount int
	dayStart time.Time
}

// NewBotEngine wires all subsystems.
func NewBotEngine(
	store *Store,
	indicators *IndicatorCalculator,
	news *NewsCollector,
	ai *AIAnalyzer,
	processor *SignalProcessor,
	leveling *LevelingEngine,
	logger *zap.Logger,
) *BotEngine {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &BotEngine{
		store:      store,
		indicators: indicators,
		news:       news,
		ai:         ai,
		processor:  processor,
		leveling:   leveling,
		marketData: newMarketFeed(),
		logger:     logger,
		subs:       make(map[string][]chan EngineEvent),
	}
}

// StartBot launches a runner goroutine.
func (e *BotEngine) StartBot(ctx context.Context, bot *Bot) error {
	if bot.Status == StatusRunning {
		return fmt.Errorf("bot already running")
	}
	if _, loaded := e.runners.Load(bot.ID); loaded {
		return fmt.Errorf("bot already has a runner")
	}

	runner := &botRunner{
		botID:    bot.ID,
		stopCh:   make(chan struct{}),
		pauseCh:  make(chan bool, 4),
		dayStart: time.Now(),
	}
	e.runners.Store(bot.ID, runner)

	if err := e.store.UpdateBotStatus(ctx, bot.ID, StatusRunning); err != nil {
		e.runners.Delete(bot.ID)
		return err
	}

	runner.wg.Add(1)
	go e.runLoop(context.Background(), runner)
	e.broadcast(bot.ID, EngineEvent{BotID: bot.ID, Type: "status", Data: StatusRunning, At: time.Now()})
	return nil
}

// StopBot signals the runner to exit.
func (e *BotEngine) StopBot(ctx context.Context, botID string) error {
	v, ok := e.runners.Load(botID)
	if !ok {
		// Not running in memory; still mark stopped in DB (idempotent).
		_ = e.store.UpdateBotStatus(ctx, botID, StatusStopped)
		return nil
	}
	r := v.(*botRunner)
	close(r.stopCh)
	r.wg.Wait()
	e.runners.Delete(botID)
	if err := e.store.UpdateBotStatus(ctx, botID, StatusStopped); err != nil {
		return err
	}
	e.broadcast(botID, EngineEvent{BotID: botID, Type: "status", Data: StatusStopped, At: time.Now()})
	return nil
}

// PauseBot toggles pause on a running bot.
func (e *BotEngine) PauseBot(ctx context.Context, botID string) error {
	v, ok := e.runners.Load(botID)
	if !ok {
		return fmt.Errorf("bot not running")
	}
	r := v.(*botRunner)
	r.pauseCh <- true
	_ = e.store.UpdateBotStatus(ctx, botID, StatusPaused)
	e.broadcast(botID, EngineEvent{BotID: botID, Type: "status", Data: StatusPaused, At: time.Now()})
	return nil
}

// ResumeBot resumes a paused bot.
func (e *BotEngine) ResumeBot(ctx context.Context, botID string) error {
	v, ok := e.runners.Load(botID)
	if !ok {
		return fmt.Errorf("bot not running")
	}
	r := v.(*botRunner)
	r.pauseCh <- false
	_ = e.store.UpdateBotStatus(ctx, botID, StatusRunning)
	e.broadcast(botID, EngineEvent{BotID: botID, Type: "status", Data: StatusRunning, At: time.Now()})
	return nil
}

// Subscribe returns a channel for receiving engine events for a bot. Caller must call unsubscribe.
func (e *BotEngine) Subscribe(botID string) (<-chan EngineEvent, func()) {
	ch := make(chan EngineEvent, 32)
	e.subsMu.Lock()
	e.subs[botID] = append(e.subs[botID], ch)
	e.subsMu.Unlock()
	unsub := func() {
		e.subsMu.Lock()
		defer e.subsMu.Unlock()
		list := e.subs[botID]
		for i, c := range list {
			if c == ch {
				e.subs[botID] = append(list[:i], list[i+1:]...)
				break
			}
		}
		close(ch)
	}
	return ch, unsub
}

func (e *BotEngine) broadcast(botID string, event EngineEvent) {
	e.subsMu.RLock()
	defer e.subsMu.RUnlock()
	for _, ch := range e.subs[botID] {
		select {
		case ch <- event:
		default:
			// drop if subscriber is slow
		}
	}
}

// runLoop is the bot's main decision loop.
func (e *BotEngine) runLoop(ctx context.Context, r *botRunner) {
	defer r.wg.Done()

	tick := 10 * time.Second
	ticker := time.NewTicker(tick)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-r.stopCh:
			return
		case paused := <-r.pauseCh:
			r.paused = paused
		case <-ticker.C:
			if r.paused {
				continue
			}
			if err := e.processBot(ctx, r); err != nil {
				e.logger.Error("bot process failed", zap.String("bot_id", r.botID), zap.Error(err))
			}
		}
	}
}

func (e *BotEngine) processBot(ctx context.Context, r *botRunner) error {
	bot, err := e.store.GetBotInternal(ctx, r.botID)
	if err != nil {
		return err
	}

	// Reset daily trade counter
	if time.Since(r.dayStart) > 24*time.Hour {
		r.dayCount = 0
		r.dayStart = time.Now()
	}
	if bot.Config.Execution.MaxDailyTrades > 0 && r.dayCount >= bot.Config.Execution.MaxDailyTrades {
		return nil
	}

	// Time restrictions
	if bot.Config.TimeRestrictions.Enabled {
		h := time.Now().Hour()
		if h < bot.Config.TimeRestrictions.StartHour || h >= bot.Config.TimeRestrictions.EndHour {
			return nil
		}
	}

	symbol := "VOL100-USD"
	if len(bot.Config.MarketSelection) > 0 {
		symbol = bot.Config.MarketSelection[0]
	}

	candles := e.marketData.GetCandles(symbol, 60)

	var techSignals map[string]float64
	if len(bot.Config.Indicators.Technical) > 0 {
		techSignals = e.indicators.Calculate(candles, bot.Config.Indicators.Technical)
	}

	var newsSig *NewsSentiment
	if bot.Config.Indicators.NewsWeight > 0 {
		newsCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		newsSig = e.news.GetLatestSentiment(newsCtx, bot.Config.NewsFilters)
		cancel()
	}

	var pattern *PatternResult
	if bot.Config.Indicators.AIPatterns {
		aiCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
		pattern = e.ai.DetectPattern(aiCtx, candles, symbol)
		cancel()
	}

	decision := e.processor.ProcessSignals(techSignals, newsSig, pattern, bot.Config)

	// Log signal
	action := ActionBelowThreshold
	if decision.ShouldTrade {
		action = ActionTradeExecuted
	} else if len(decision.SignalSources) == 0 {
		action = ActionConditionsNotMet
	}
	_ = e.store.RecordSignalLog(ctx, &BotSignalLog{
		BotID:       bot.ID,
		SignalType:  "combined",
		SignalData:  decision.SignalSources,
		ActionTaken: action,
		Confidence:  decision.Confidence,
	})
	e.broadcast(bot.ID, EngineEvent{
		BotID: bot.ID, Type: "signal", At: time.Now(),
		Data: map[string]any{"decision": decision, "action": action},
	})

	if !decision.ShouldTrade {
		return nil
	}

	r.dayCount++
	return e.executeTrade(ctx, bot, decision, candles)
}

// executeTrade creates a simulated fill and persists the trade + XP update.
func (e *BotEngine) executeTrade(ctx context.Context, bot *Bot, decision *TradeDecision, candles []SimpleCandle) error {
	stake := decimal.NewFromFloat(bot.Config.Execution.StakeAmount)
	if stake.IsZero() {
		stake = decimal.NewFromInt(10)
	}

	// Simple P&L model: outcome is biased by confidence.
	// (Paper/demo mode — no real execution.)
	winProb := 0.5 + 0.35*decision.Confidence
	win := rand.Float64() < winProb
	var pnl decimal.Decimal
	if win {
		profit := stake.Mul(decimal.NewFromFloat(0.8 + 0.2*decision.Confidence))
		pnl = profit
	} else {
		pnl = stake.Neg()
	}

	var entry, exit float64
	if len(candles) > 0 {
		entry = candles[len(candles)-1].Close
		// Move proportional to side and win
		mult := 1.0
		if decision.Side == SideSell {
			mult = -1.0
		}
		if !win {
			mult = -mult
		}
		exit = entry * (1 + mult*0.003)
	}
	entryDec := decimal.NewFromFloat(entry)
	exitDec := decimal.NewFromFloat(exit)
	payout := stake.Add(pnl)

	trade := &BotTrade{
		BotID:         bot.ID,
		Symbol:        decision.Symbol,
		ContractType:  decision.ContractType,
		Side:          decision.Side,
		Stake:         stake,
		Payout:        &payout,
		PnL:           &pnl,
		EntryPrice:    &entryDec,
		ExitPrice:     &exitDec,
		ExecutionMode: bot.ExecutionMode,
		SignalSources: decision.SignalSources,
		ExecutedAt:    time.Now(),
		Metadata:      map[string]any{"confidence": decision.Confidence},
	}

	// Calculate XP BEFORE persisting so it's stored on the trade row.
	xpGain, newWinStreak, newBestStreak := e.leveling.CalculateXPForTrade(trade, bot)
	trade.XPGained = xpGain

	if err := e.store.RecordBotTrade(ctx, trade); err != nil {
		return fmt.Errorf("record trade: %w", err)
	}

	// Award XP and check for level-up
	levelUp, err := e.leveling.AwardXPAndCheckLevelUp(ctx, bot, xpGain, newWinStreak, newBestStreak)
	if err != nil {
		e.logger.Warn("award xp failed", zap.Error(err))
	}

	e.broadcast(bot.ID, EngineEvent{BotID: bot.ID, Type: "trade", Data: trade, At: time.Now()})
	if levelUp != nil {
		e.broadcast(bot.ID, EngineEvent{BotID: bot.ID, Type: "level_up", Data: levelUp, At: time.Now()})
	}

	// Push updated analytics
	if a, err := e.store.getBotAnalyticsInternal(ctx, bot.ID); err == nil {
		e.broadcast(bot.ID, EngineEvent{BotID: bot.ID, Type: "analytics", Data: a, At: time.Now()})
	}
	return nil
}

// marketFeed produces deterministic-looking random walk candles per symbol.
// Used for paper-trading mode so the MVP runs without external market data.
type marketFeed struct {
	mu      sync.Mutex
	history map[string][]SimpleCandle
	rng     *rand.Rand
}

func newMarketFeed() *marketFeed {
	return &marketFeed{
		history: make(map[string][]SimpleCandle),
		rng:     rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// GetCandles returns the last `count` candles, extending the series if needed.
func (m *marketFeed) GetCandles(symbol string, count int) []SimpleCandle {
	m.mu.Lock()
	defer m.mu.Unlock()

	series, ok := m.history[symbol]
	if !ok || len(series) == 0 {
		series = m.seed(symbol, count)
	}
	// Extend by one candle each call to simulate live ticks
	last := series[len(series)-1]
	next := m.nextCandle(last)
	series = append(series, next)
	if len(series) > 500 {
		series = series[len(series)-500:]
	}
	m.history[symbol] = series

	if len(series) <= count {
		out := make([]SimpleCandle, len(series))
		copy(out, series)
		return out
	}
	out := make([]SimpleCandle, count)
	copy(out, series[len(series)-count:])
	return out
}

// GetLatestTick returns the last candle's close for a symbol.
func (m *marketFeed) GetLatestTick(symbol string) MarketTick {
	m.mu.Lock()
	defer m.mu.Unlock()
	series := m.history[symbol]
	if len(series) == 0 {
		series = m.seed(symbol, 60)
		m.history[symbol] = series
	}
	last := series[len(series)-1]
	var change float64
	if len(series) > 1 {
		prev := series[len(series)-2]
		change = ((last.Close - prev.Close) / prev.Close) * 100
	}
	return MarketTick{Symbol: symbol, Price: last.Close, Change: change, Timestamp: last.Timestamp}
}

func (m *marketFeed) seed(symbol string, count int) []SimpleCandle {
	basePrice := basePriceFor(symbol)
	now := time.Now().Add(-time.Duration(count) * time.Minute)
	out := make([]SimpleCandle, 0, count+1)
	price := basePrice
	for i := 0; i <= count; i++ {
		step := (m.rng.Float64() - 0.5) * basePrice * 0.01
		newPrice := price + step
		c := SimpleCandle{
			Timestamp: now.Add(time.Duration(i) * time.Minute),
			Open:      price,
			Close:     newPrice,
			High:      math.Max(price, newPrice) * (1 + 0.002*m.rng.Float64()),
			Low:       math.Min(price, newPrice) * (1 - 0.002*m.rng.Float64()),
			Volume:    1000 + m.rng.Float64()*500,
		}
		out = append(out, c)
		price = newPrice
	}
	return out
}

func (m *marketFeed) nextCandle(last SimpleCandle) SimpleCandle {
	step := (m.rng.Float64() - 0.5) * last.Close * 0.006
	newPrice := last.Close + step
	return SimpleCandle{
		Timestamp: time.Now(),
		Open:      last.Close,
		Close:     newPrice,
		High:      math.Max(last.Close, newPrice) * (1 + 0.002*m.rng.Float64()),
		Low:       math.Min(last.Close, newPrice) * (1 - 0.002*m.rng.Float64()),
		Volume:    1000 + m.rng.Float64()*500,
	}
}

func basePriceFor(symbol string) float64 {
	switch symbol {
	case "VOL100-USD":
		return 10000
	case "VOL75-USD":
		return 7500
	case "VOL50-USD":
		return 5000
	case "VOL25-USD":
		return 2500
	default:
		return 1000
	}
}

// GetMarketFeed exposes the internal feed for live-data endpoints.
func (e *BotEngine) GetMarketFeed() *marketFeed { return e.marketData }
