package tradingbot

import "math"

// SignalProcessor turns indicator/news/AI signals into a TradeDecision.
type SignalProcessor struct{}

// NewSignalProcessor returns a stateless processor.
func NewSignalProcessor() *SignalProcessor { return &SignalProcessor{} }

// ProcessSignals combines available signals with risk-profile-based weights.
// A positive weighted score biases BUY/CALL; negative biases SELL/PUT.
func (sp *SignalProcessor) ProcessSignals(
	techSignals map[string]float64,
	news *NewsSentiment,
	pattern *PatternResult,
	cfg BotConfig,
	activeSymbol string,
) *TradeDecision {
	decision := &TradeDecision{
		SignalSources: make(map[string]any),
	}

	var scores []float64
	var weights []float64

	// --- Technical ---
	if techSignals != nil {
		if rsi, ok := techSignals["rsi"]; ok {
			if rsi < 30 {
				scores = append(scores, 0.8)
				weights = append(weights, 1.0)
				decision.SignalSources["technical"] = map[string]any{"rsi": rsi, "signal": "oversold"}
			} else if rsi > 70 {
				scores = append(scores, -0.8)
				weights = append(weights, 1.0)
				decision.SignalSources["technical"] = map[string]any{"rsi": rsi, "signal": "overbought"}
			}
		}
		if macd, ok := techSignals["macd"]; ok {
			if sig, ok2 := techSignals["macd_signal"]; ok2 {
				diff := macd - sig
				score := clamp(diff*50, -0.8, 0.8)
				scores = append(scores, score)
				weights = append(weights, 0.7)
				decision.SignalSources["macd"] = map[string]any{"macd": macd, "signal": sig, "hist": diff}
			}
		}
	}

	// --- News ---
	effectiveNewsW := cfg.Indicators.NewsWeight
	if cfg.AgentPolicy != nil {
		effectiveNewsW *= TuningFromAgentPolicy(cfg.AgentPolicy).NewsMult
	}
	if effectiveNewsW > 1 {
		effectiveNewsW = 1
	}
	if effectiveNewsW < 0 {
		effectiveNewsW = 0
	}
	if news != nil && effectiveNewsW > 0 {
		scores = append(scores, news.Score)
		weights = append(weights, effectiveNewsW)
		decision.SignalSources["news"] = map[string]any{
			"sentiment":  news.Score,
			"item_count": news.ItemCount,
		}
	}

	// --- AI Pattern ---
	if pattern != nil && cfg.Indicators.AIPatterns {
		var patternScore float64
		switch pattern.Name {
		case "volatility_contraction":
			patternScore = 0.6
		case "trend_reversal":
			patternScore = -0.7 // reversal biases opposite to recent trend
		case "continuation_pattern":
			patternScore = 0.5
		default:
			patternScore = 0
		}
		if patternScore != 0 {
			scores = append(scores, patternScore)
			weights = append(weights, pattern.Confidence)
			decision.SignalSources["ai_pattern"] = map[string]any{
				"name":       pattern.Name,
				"confidence": pattern.Confidence,
			}
		}
	}

	if len(scores) == 0 {
		return decision
	}

	// Weighted average
	var sumW, sum float64
	for i, s := range scores {
		sumW += weights[i]
		sum += s * weights[i]
	}
	if sumW == 0 {
		return decision
	}
	avg := sum / sumW

	// Risk profile threshold: lower = fires more often
	threshold := 0.5
	switch cfg.RiskProfile {
	case "aggressive":
		threshold = 0.3
	case "moderate":
		threshold = 0.45
	case "conservative":
		threshold = 0.6
	}
	if cfg.AgentPolicy != nil {
		threshold += TuningFromAgentPolicy(cfg.AgentPolicy).ThresholdDelta
	}
	threshold = clamp(threshold, 0.05, 0.95)

	confidence := math.Abs(avg)
	decision.Confidence = confidence
	decision.SignalSources["confidence"] = confidence

	if confidence < threshold {
		return decision
	}

	// Active symbol (engine rotates across markets + assets)
	if activeSymbol != "" {
		decision.Symbol = activeSymbol
	} else if syms := TradingSymbols(cfg); len(syms) > 0 {
		decision.Symbol = syms[0]
	}
	ct := "CALL"
	if len(cfg.ContractTypes) > 0 {
		ct = cfg.ContractTypes[0]
	}

	decision.ShouldTrade = true
	if avg > 0 {
		decision.Side = SideBuy
		decision.ContractType = ct
	} else {
		decision.Side = SideSell
		if ct == "CALL" {
			decision.ContractType = "PUT"
		} else {
			decision.ContractType = ct
		}
	}
	return decision
}

func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
