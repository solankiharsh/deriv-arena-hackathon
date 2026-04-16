package competition

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/shopspring/decimal"
)

const maxPartnerRulesJSONBytes = 12 << 10

var allowedDataSourceWeightKeys = map[string]struct{}{
	"deriv_ticks": {},
	"sentiment":   {},
	"pattern":     {},
	"partner":     {},
}

// PartnerRules is host-published metadata (stored as JSONB on competitions).
// Monetary fields use decimal strings in JSON for precision (same as starting_balance).
type PartnerRules struct {
	MaxStakePerContract *decimal.Decimal `json:"max_stake_per_contract,omitempty"`
	MaxLossPerDay       *decimal.Decimal `json:"max_loss_per_day,omitempty"`
	MaxDrawdownPercent  *decimal.Decimal `json:"max_drawdown_percent,omitempty"`
	MarketBias          *decimal.Decimal `json:"market_bias,omitempty"`
	DataSourceWeights   map[string]float64 `json:"data_source_weights,omitempty"`
}

type partnerRulesWire struct {
	MaxStakePerContract *string            `json:"max_stake_per_contract"`
	MaxLossPerDay       *string            `json:"max_loss_per_day"`
	MaxDrawdownPercent  *string            `json:"max_drawdown_percent"`
	MarketBias          *string            `json:"market_bias"`
	DataSourceWeights   map[string]float64 `json:"data_source_weights"`
}

func parseOptionalPositiveDecimal(label string, s *string) (*decimal.Decimal, error) {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil, nil
	}
	d, err := decimal.NewFromString(strings.TrimSpace(*s))
	if err != nil {
		return nil, fmt.Errorf("%s: invalid decimal", label)
	}
	if d.IsNegative() || d.IsZero() {
		return nil, fmt.Errorf("%s: must be positive", label)
	}
	return &d, nil
}

func parseOptionalPercent(label string, s *string) (*decimal.Decimal, error) {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil, nil
	}
	d, err := decimal.NewFromString(strings.TrimSpace(*s))
	if err != nil {
		return nil, fmt.Errorf("%s: invalid number", label)
	}
	if d.IsNegative() || d.GreaterThan(decimal.NewFromInt(100)) {
		return nil, fmt.Errorf("%s: must be between 0 and 100", label)
	}
	return &d, nil
}

func parseOptionalBias(s *string) (*decimal.Decimal, error) {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil, nil
	}
	d, err := decimal.NewFromString(strings.TrimSpace(*s))
	if err != nil {
		return nil, fmt.Errorf("market_bias: invalid number")
	}
	if d.LessThan(decimal.NewFromInt(-1)) || d.GreaterThan(decimal.NewFromInt(1)) {
		return nil, fmt.Errorf("market_bias: must be between -1 and 1")
	}
	return &d, nil
}

// ValidatePartnerRulesJSON checks size, allowed keys, numeric ranges; returns canonical JSON.
func ValidatePartnerRulesJSON(raw json.RawMessage) (json.RawMessage, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return json.RawMessage("{}"), nil
	}
	if len(raw) > maxPartnerRulesJSONBytes {
		return nil, errors.New("partner_rules exceeds maximum size")
	}
	var extra map[string]json.RawMessage
	if err := json.Unmarshal(raw, &extra); err != nil {
		return nil, fmt.Errorf("partner_rules: %w", err)
	}
	allowedTop := map[string]struct{}{
		"max_stake_per_contract": {},
		"max_loss_per_day":       {},
		"max_drawdown_percent":   {},
		"market_bias":            {},
		"data_source_weights":    {},
	}
	for k := range extra {
		if _, ok := allowedTop[k]; !ok {
			return nil, fmt.Errorf("partner_rules: unknown field %q", k)
		}
	}

	var w partnerRulesWire
	if err := json.Unmarshal(raw, &w); err != nil {
		return nil, fmt.Errorf("partner_rules: %w", err)
	}

	out := PartnerRules{}
	var err error
	if out.MaxStakePerContract, err = parseOptionalPositiveDecimal("max_stake_per_contract", w.MaxStakePerContract); err != nil {
		return nil, err
	}
	if out.MaxLossPerDay, err = parseOptionalPositiveDecimal("max_loss_per_day", w.MaxLossPerDay); err != nil {
		return nil, err
	}
	if out.MaxDrawdownPercent, err = parseOptionalPercent("max_drawdown_percent", w.MaxDrawdownPercent); err != nil {
		return nil, err
	}
	if out.MarketBias, err = parseOptionalBias(w.MarketBias); err != nil {
		return nil, err
	}
	if len(w.DataSourceWeights) > 0 {
		out.DataSourceWeights = make(map[string]float64, len(w.DataSourceWeights))
		for k, v := range w.DataSourceWeights {
			if _, ok := allowedDataSourceWeightKeys[k]; !ok {
				return nil, fmt.Errorf("data_source_weights: unknown key %q", k)
			}
			if v < 0 || v > 10 || v != v {
				return nil, fmt.Errorf("data_source_weights.%s: must be a number 0..10", k)
			}
			out.DataSourceWeights[k] = v
		}
	}

	canonical, err := json.Marshal(out)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(canonical), nil
}

// ParsePartnerRules decodes stored JSON; never fails with panic — invalid JSON yields empty rules.
func ParsePartnerRules(raw []byte) PartnerRules {
	if len(raw) == 0 || string(raw) == "null" {
		return PartnerRules{}
	}
	var out PartnerRules
	if err := json.Unmarshal(raw, &out); err != nil {
		return PartnerRules{}
	}
	return out
}
