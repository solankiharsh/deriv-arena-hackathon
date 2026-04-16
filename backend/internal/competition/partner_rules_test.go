package competition

import (
	"encoding/json"
	"testing"

	"github.com/shopspring/decimal"
)

func TestValidatePartnerRulesJSON_Empty(t *testing.T) {
	out, err := ValidatePartnerRulesJSON(nil)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != "{}" {
		t.Fatalf("expected {}, got %s", out)
	}
}

func TestValidatePartnerRulesJSON_RoundTrip(t *testing.T) {
	raw := json.RawMessage(`{
		"max_stake_per_contract": "50",
		"max_drawdown_percent": "25",
		"market_bias": "-0.25",
		"data_source_weights": {"deriv_ticks": 1, "sentiment": 0.5}
	}`)
	out, err := ValidatePartnerRulesJSON(raw)
	if err != nil {
		t.Fatal(err)
	}
	var pr PartnerRules
	if err := json.Unmarshal(out, &pr); err != nil {
		t.Fatal(err)
	}
	if pr.MaxStakePerContract == nil {
		t.Fatal("expected max stake")
	}
	want, _ := decimal.NewFromString("50")
	if !pr.MaxStakePerContract.Equal(want) {
		t.Fatalf("max stake: %v", pr.MaxStakePerContract)
	}
}

func TestValidatePartnerRulesJSON_UnknownField(t *testing.T) {
	raw := json.RawMessage(`{"evil": 1}`)
	_, err := ValidatePartnerRulesJSON(raw)
	if err == nil {
		t.Fatal("expected error")
	}
}
