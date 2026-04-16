package derivcontract

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/shopspring/decimal"
)

// AllowedContractTypes is a conservative allowlist for proposal flow (extend as needed).
var AllowedContractTypes = map[string]struct{}{
	"CALL": {}, "PUT": {},
	"ACCU": {},
	"MULTUP": {}, "MULTDOWN": {},
	"DIGITDIFF": {}, "DIGITEVEN": {}, "DIGITODD": {}, "DIGITOVER": {}, "DIGITUNDER": {},
	"RISE": {}, "FALL": {},
}

const (
	maxDurationValue = 100000
	maxStakeUSD      = 10000.0
)

// ProposalParams holds validated fields for Deriv proposal → buy.
type ProposalParams struct {
	ContractType string
	Symbol       string // Deriv underlying e.g. 1HZ100V
	Duration     int
	DurationUnit string // t, s, m, h, d
	Stake        decimal.Decimal
	GrowthRate   *float64
	Multiplier   *float64
	StopLoss     *float64
	TakeProfit   *float64
}

// NormalizeProposalParams builds validated proposal fields from pair, stake (notional), and Params map.
func NormalizeProposalParams(pair string, stake decimal.Decimal, params map[string]any) (*ProposalParams, error) {
	if params == nil {
		return nil, fmt.Errorf("derivcontract: params required")
	}
	ct, _ := params["contract_type"].(string)
	ct = strings.TrimSpace(strings.ToUpper(ct))
	if ct == "" {
		return nil, fmt.Errorf("derivcontract: contract_type required")
	}
	if _, ok := AllowedContractTypes[ct]; !ok {
		return nil, fmt.Errorf("derivcontract: contract_type not allowed")
	}

	symbol, _ := params["symbol"].(string)
	symbol = strings.TrimSpace(symbol)
	if symbol == "" {
		var err error
		symbol, err = PairToDeriv(pair)
		if err != nil {
			return nil, err
		}
	}
	if err := ValidateDerivUnderlying(symbol); err != nil {
		return nil, err
	}

	duration, err := intFromAny(params["duration"])
	if err != nil || duration <= 0 {
		return nil, fmt.Errorf("derivcontract: duration must be a positive integer")
	}
	if duration > maxDurationValue {
		return nil, fmt.Errorf("derivcontract: duration exceeds maximum")
	}

	du, _ := params["duration_unit"].(string)
	du = strings.TrimSpace(strings.ToLower(du))
	if du == "" {
		return nil, fmt.Errorf("derivcontract: duration_unit required")
	}
	switch du {
	case "t", "s", "m", "h", "d":
	default:
		return nil, fmt.Errorf("derivcontract: duration_unit must be t,s,m,h,d")
	}

	if stake.IsNegative() || stake.IsZero() {
		return nil, fmt.Errorf("derivcontract: positive stake required")
	}
	if stake.GreaterThan(decimal.NewFromFloat(maxStakeUSD)) {
		return nil, fmt.Errorf("derivcontract: stake exceeds maximum")
	}

	out := &ProposalParams{
		ContractType: ct,
		Symbol:       symbol,
		Duration:     duration,
		DurationUnit: du,
		Stake:        stake,
	}
	if v, ok := floatPtrFromAny(params["growth_rate"]); ok {
		out.GrowthRate = v
	}
	if v, ok := floatPtrFromAny(params["multiplier"]); ok {
		out.Multiplier = v
	}
	if v, ok := floatPtrFromAny(params["stop_loss"]); ok {
		out.StopLoss = v
	}
	if v, ok := floatPtrFromAny(params["take_profit"]); ok {
		out.TakeProfit = v
	}
	return out, nil
}

func intFromAny(v any) (int, error) {
	switch x := v.(type) {
	case int:
		return x, nil
	case int32:
		return int(x), nil
	case int64:
		return int(x), nil
	case float64:
		if x != float64(int(x)) {
			return 0, fmt.Errorf("not an integer")
		}
		return int(x), nil
	case json.Number:
		i64, err := x.Int64()
		if err != nil {
			return 0, err
		}
		if i64 > int64(maxDurationValue) || i64 < 0 {
			return 0, fmt.Errorf("out of range")
		}
		return int(i64), nil
	default:
		return 0, fmt.Errorf("unsupported type")
	}
}

func floatPtrFromAny(v any) (*float64, bool) {
	switch x := v.(type) {
	case float64:
		return &x, true
	case int:
		f := float64(x)
		return &f, true
	case int64:
		f := float64(x)
		return &f, true
	case json.Number:
		f, err := x.Float64()
		if err != nil {
			return nil, false
		}
		return &f, true
	default:
		return nil, false
	}
}
