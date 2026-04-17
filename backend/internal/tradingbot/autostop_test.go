package tradingbot

import (
	"testing"

	"github.com/shopspring/decimal"
)

func TestEvaluateAutoStop(t *testing.T) {
	t.Parallel()
	base := ExecutionConfig{
		PaperBankroll:        10000,
		RiskTolerancePercent: 10,
		TargetPayoutUsd:      100,
		AutoStopMode:         AutoStopFirstHit,
	}
	// max loss = 1000 when session PnL <= -1000
	t.Run("first_hit_target", func(t *testing.T) {
		ev := evaluateAutoStop(decimal.NewFromInt(100), base)
		if !ev.ShouldStop || ev.Reason != StopReasonTargetPayout {
			t.Fatalf("got %+v", ev)
		}
	})
	t.Run("first_hit_risk", func(t *testing.T) {
		ev := evaluateAutoStop(decimal.NewFromInt(-1000), base)
		if !ev.ShouldStop || ev.Reason != StopReasonRiskLimit {
			t.Fatalf("got %+v", ev)
		}
	})
	t.Run("no_limits", func(t *testing.T) {
		ev := evaluateAutoStop(decimal.NewFromInt(50), ExecutionConfig{})
		if ev.ShouldStop {
			t.Fatal("expected no stop")
		}
	})
	t.Run("target_only_ignores_risk", func(t *testing.T) {
		cfg := base
		cfg.AutoStopMode = AutoStopTargetOnly
		ev := evaluateAutoStop(decimal.NewFromInt(-5000), cfg)
		if ev.ShouldStop {
			t.Fatal("target_only should not stop on risk")
		}
	})
	t.Run("risk_only_ignores_target", func(t *testing.T) {
		cfg := base
		cfg.AutoStopMode = AutoStopRiskOnly
		ev := evaluateAutoStop(decimal.NewFromInt(500), cfg)
		if ev.ShouldStop {
			t.Fatal("risk_only should not stop on target")
		}
	})
	t.Run("empty_mode_defaults_first_hit", func(t *testing.T) {
		cfg := base
		cfg.AutoStopMode = ""
		ev := evaluateAutoStop(decimal.NewFromInt(100), cfg)
		if !ev.ShouldStop {
			t.Fatal("expected stop")
		}
	})
}
