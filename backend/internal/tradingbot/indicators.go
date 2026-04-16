package tradingbot

import "math"

// IndicatorCalculator computes standard TA signals on a candle series.
type IndicatorCalculator struct{}

// NewIndicatorCalculator returns a stateless calculator.
func NewIndicatorCalculator() *IndicatorCalculator { return &IndicatorCalculator{} }

// Calculate returns a flat map of named indicator values.
// Unsupported indicator names are silently skipped.
func (ic *IndicatorCalculator) Calculate(candles []SimpleCandle, indicators []string) map[string]float64 {
	out := make(map[string]float64)
	for _, ind := range indicators {
		switch ind {
		case "rsi":
			out["rsi"] = ic.RSI(candles, 14)
		case "macd":
			macd, signal, hist := ic.MACD(candles, 12, 26, 9)
			out["macd"] = macd
			out["macd_signal"] = signal
			out["macd_hist"] = hist
		case "bollinger":
			upper, middle, lower := ic.Bollinger(candles, 20, 2)
			out["bb_upper"] = upper
			out["bb_middle"] = middle
			out["bb_lower"] = lower
		}
	}
	return out
}

// RSI computes the classical 14-period RSI. Neutral 50 when insufficient data.
func (ic *IndicatorCalculator) RSI(candles []SimpleCandle, period int) float64 {
	if period <= 0 {
		period = 14
	}
	if len(candles) < period+1 {
		return 50
	}
	var gains, losses float64
	start := len(candles) - period - 1
	for i := start; i < len(candles)-1; i++ {
		change := candles[i+1].Close - candles[i].Close
		if change > 0 {
			gains += change
		} else {
			losses += -change
		}
	}
	avgGain := gains / float64(period)
	avgLoss := losses / float64(period)
	if avgLoss == 0 {
		if avgGain == 0 {
			return 50
		}
		return 100
	}
	rs := avgGain / avgLoss
	return 100 - (100 / (1 + rs))
}

// MACD returns (macd, signal, histogram) with EMA 12/26/9 defaults.
func (ic *IndicatorCalculator) MACD(candles []SimpleCandle, fast, slow, signalPeriod int) (float64, float64, float64) {
	if len(candles) < slow+signalPeriod {
		return 0, 0, 0
	}
	closes := closePrices(candles)
	emaFast := emaSeries(closes, fast)
	emaSlow := emaSeries(closes, slow)
	if len(emaFast) == 0 || len(emaSlow) == 0 {
		return 0, 0, 0
	}
	// Align lengths (emaSlow is shorter-starting)
	macdLine := make([]float64, len(closes))
	for i := range closes {
		macdLine[i] = emaFast[i] - emaSlow[i]
	}
	signalLine := emaSeries(macdLine, signalPeriod)
	last := len(macdLine) - 1
	return macdLine[last], signalLine[last], macdLine[last] - signalLine[last]
}

// Bollinger returns upper/middle/lower bands for (period, stdDev).
func (ic *IndicatorCalculator) Bollinger(candles []SimpleCandle, period int, stdDev float64) (float64, float64, float64) {
	if len(candles) < period {
		return 0, 0, 0
	}
	window := candles[len(candles)-period:]
	var sum float64
	for _, c := range window {
		sum += c.Close
	}
	mean := sum / float64(period)
	var variance float64
	for _, c := range window {
		variance += (c.Close - mean) * (c.Close - mean)
	}
	sd := math.Sqrt(variance / float64(period))
	return mean + stdDev*sd, mean, mean - stdDev*sd
}

func closePrices(candles []SimpleCandle) []float64 {
	out := make([]float64, len(candles))
	for i, c := range candles {
		out[i] = c.Close
	}
	return out
}

// emaSeries returns a same-length EMA series seeded with SMA of first `period`.
func emaSeries(values []float64, period int) []float64 {
	n := len(values)
	out := make([]float64, n)
	if n == 0 || period <= 0 {
		return out
	}
	if n < period {
		return out
	}
	// Seed with SMA
	var sum float64
	for i := 0; i < period; i++ {
		sum += values[i]
		out[i] = sum / float64(i+1)
	}
	sma := sum / float64(period)
	out[period-1] = sma
	k := 2.0 / float64(period+1)
	for i := period; i < n; i++ {
		out[i] = values[i]*k + out[i-1]*(1-k)
	}
	return out
}
