package tradingbot

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"go.uber.org/zap"
)

// AIAnalyzer detects chart patterns using an optional LLM (OpenAI) with a
// deterministic heuristic fallback so bots always get a signal.
type AIAnalyzer struct {
	apiKey string
	client *http.Client
	logger *zap.Logger
}

// NewAIAnalyzer reads OPENAI_API_KEY from env. With no key the heuristic fallback is used.
func NewAIAnalyzer(logger *zap.Logger) *AIAnalyzer {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &AIAnalyzer{
		apiKey: os.Getenv("OPENAI_API_KEY"),
		client: &http.Client{Timeout: 8 * time.Second},
		logger: logger,
	}
}

// DetectPattern returns the most likely pattern name plus confidence.
func (ai *AIAnalyzer) DetectPattern(ctx context.Context, candles []SimpleCandle, symbol string) *PatternResult {
	if len(candles) < 20 {
		return &PatternResult{Name: "insufficient_data", Confidence: 0}
	}
	// Prefer LLM if key present; otherwise fall back to deterministic heuristics.
	if ai.apiKey != "" {
		if res := ai.callOpenAI(ctx, candles, symbol); res != nil {
			return res
		}
	}
	return ai.heuristicPattern(candles)
}

// heuristicPattern detects volatility contraction, trend, and reversal patterns
// with no external dependencies. Deterministic so tests are stable.
func (ai *AIAnalyzer) heuristicPattern(candles []SimpleCandle) *PatternResult {
	n := len(candles)
	recent := candles[n-20:]

	// Range measure
	var high, low float64 = recent[0].High, recent[0].Low
	for _, c := range recent {
		if c.High > high {
			high = c.High
		}
		if c.Low < low {
			low = c.Low
		}
	}
	rangePct := (high - low) / recent[len(recent)-1].Close
	// Volatility (std dev of returns)
	var mean float64
	returns := make([]float64, 0, len(recent)-1)
	for i := 1; i < len(recent); i++ {
		r := (recent[i].Close - recent[i-1].Close) / recent[i-1].Close
		returns = append(returns, r)
		mean += r
	}
	mean /= float64(len(returns))
	var variance float64
	for _, r := range returns {
		variance += (r - mean) * (r - mean)
	}
	stdDev := math.Sqrt(variance / float64(len(returns)))

	firstHalf := 0.0
	secondHalf := 0.0
	for i := 0; i < 10; i++ {
		firstHalf += recent[i].Close
		secondHalf += recent[i+10].Close
	}
	firstHalf /= 10
	secondHalf /= 10

	// Trend reversal: big directional swing between halves
	trendSwing := (secondHalf - firstHalf) / firstHalf

	switch {
	case stdDev < 0.002 && rangePct < 0.01:
		return &PatternResult{Name: "volatility_contraction", Confidence: 0.72}
	case math.Abs(trendSwing) > 0.015:
		return &PatternResult{Name: "trend_reversal", Confidence: 0.68}
	case trendSwing > 0.005:
		return &PatternResult{Name: "continuation_pattern", Confidence: 0.6}
	default:
		return &PatternResult{Name: "neutral", Confidence: 0.4}
	}
}

type openAIRequest struct {
	Model    string              `json:"model"`
	Messages []openAIMessage     `json:"messages"`
	MaxTokens int                `json:"max_tokens"`
	Temperature float64          `json:"temperature"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (ai *AIAnalyzer) callOpenAI(ctx context.Context, candles []SimpleCandle, symbol string) *PatternResult {
	candleText := formatCandlesForLLM(candles[len(candles)-20:])
	// Use XML delimiters to separate user-controlled data from system instructions
	// (prompt-injection defense).
	systemPrompt := `You are a technical analysis expert. Respond with ONLY a single pattern name from: volatility_contraction, trend_reversal, continuation_pattern, neutral. No explanation.`
	userPrompt := fmt.Sprintf(`<symbol>%s</symbol>
<candles>
%s
</candles>
Identify the single most likely pattern.`, sanitizeSymbol(symbol), candleText)

	body, _ := json.Marshal(openAIRequest{
		Model:       "gpt-4o-mini",
		Temperature: 0.2,
		MaxTokens:   16,
		Messages: []openAIMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.openai.com/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+ai.apiKey)

	resp, err := ai.client.Do(req)
	if err != nil {
		ai.logger.Debug("openai request failed", zap.Error(err))
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		ai.logger.Debug("openai non-200", zap.Int("status", resp.StatusCode))
		return nil
	}

	var parsed openAIResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil
	}
	if len(parsed.Choices) == 0 {
		return nil
	}

	name := strings.ToLower(strings.TrimSpace(parsed.Choices[0].Message.Content))
	// Whitelist allowed pattern names to prevent injection into downstream logic.
	allowed := map[string]bool{
		"volatility_contraction": true,
		"trend_reversal":         true,
		"continuation_pattern":   true,
		"neutral":                true,
	}
	if !allowed[name] {
		return &PatternResult{Name: "neutral", Confidence: 0.4}
	}
	return &PatternResult{Name: name, Confidence: 0.75}
}

func sanitizeSymbol(s string) string {
	// Allow alnum, dash, underscore only.
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			b.WriteRune(r)
		}
	}
	if b.Len() == 0 {
		return "UNKNOWN"
	}
	return b.String()
}

func formatCandlesForLLM(candles []SimpleCandle) string {
	var b strings.Builder
	for i, c := range candles {
		fmt.Fprintf(&b, "%d: O=%.4f H=%.4f L=%.4f C=%.4f\n", i+1, c.Open, c.High, c.Low, c.Close)
	}
	return b.String()
}
