package competition

import (
	"testing"

	"github.com/shopspring/decimal"
)

func TestMaxDrawdownPctAlongPath_flat(t *testing.T) {
	sb := decimal.RequireFromString("10000")
	dd := maxDrawdownPctAlongPath(sb, nil, decimal.RequireFromString("-500"))
	// peak 10000, eq 9500 -> 5%
	if !dd.Equal(decimal.RequireFromString("5")) {
		t.Fatalf("got %v want 5", dd)
	}
}

func TestMaxDrawdownPctAlongPath_recovery(t *testing.T) {
	sb := decimal.RequireFromString("10000")
	prior := []decimal.Decimal{
		decimal.RequireFromString("-1000"),
		decimal.RequireFromString("500"),
	}
	// eq: 9000, 9500 — peak 10000 then 9500? peak updates: 10000, eq 9000 dd 10%; eq 9500 peak still 10000 dd 5%; max 10%
	dd := maxDrawdownPctAlongPath(sb, prior, decimal.RequireFromString("-200"))
	if dd.LessThan(decimal.RequireFromString("10")) {
		t.Fatalf("expected at least 10%% dd, got %s", dd.String())
	}
}
