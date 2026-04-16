package derivcontract

import (
	"testing"

	"github.com/shopspring/decimal"
)

func TestNormalizeProposalParams(t *testing.T) {
	pp, err := NormalizeProposalParams("VOL100-USD", decimal.NewFromInt(5), map[string]any{
		"contract_type": "CALL",
		"duration":      float64(5),
		"duration_unit": "t",
		"symbol":      "1HZ100V",
	})
	if err != nil {
		t.Fatal(err)
	}
	if pp.ContractType != "CALL" || pp.Symbol != "1HZ100V" || pp.Duration != 5 || pp.DurationUnit != "t" {
		t.Fatalf("%+v", pp)
	}
	if !pp.Stake.Equal(decimal.NewFromInt(5)) {
		t.Fatalf("stake %+v", pp.Stake)
	}
}

func TestNormalizeProposalParamsRejectUnknownContract(t *testing.T) {
	_, err := NormalizeProposalParams("VOL100-USD", decimal.NewFromInt(5), map[string]any{
		"contract_type": "NOTREAL",
		"duration":      1,
		"duration_unit": "t",
	})
	if err == nil {
		t.Fatal("expected error")
	}
}
