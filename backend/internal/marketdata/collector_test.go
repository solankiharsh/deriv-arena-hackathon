package marketdata

import (
	"context"
	"testing"

	"go.uber.org/zap"
)

func TestParseCanonicalMarkets(t *testing.T) {
	got := ParseCanonicalMarkets(" VOL100-USD , VOL75-USD ")
	if len(got) != 2 || got[0] != "VOL100-USD" || got[1] != "VOL75-USD" {
		t.Fatalf("%v", got)
	}
	if got := ParseCanonicalMarkets(""); len(got) != 1 || got[0] != "VOL100-USD" {
		t.Fatalf("%v", got)
	}
}

func TestCollectorNoSource(t *testing.T) {
	c := NewCollector(zap.NewNop(), nil)
	_, err := c.Collect(context.Background(), CollectOptions{CanonicalMarkets: []string{"VOL100-USD"}})
	if err == nil {
		t.Fatal("expected error")
	}
}
