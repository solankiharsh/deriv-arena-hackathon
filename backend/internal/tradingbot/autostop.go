package tradingbot

import (
	"github.com/shopspring/decimal"
)

// Auto-stop mode values (ExecutionConfig.AutoStopMode).
const (
	AutoStopFirstHit    = "first_hit"
	AutoStopTargetOnly  = "target_only"
	AutoStopRiskOnly    = "risk_only"
	AutoStopModeDefault = "" // treated as first_hit when limits are set
)

// AutoStopReason is emitted on engine events when the bot stops automatically.
const (
	StopReasonTargetPayout = "target_payout"
	StopReasonRiskLimit    = "risk_limit"
)

// autoStopEvaluation holds the result of checking session PnL against limits.
type autoStopEvaluation struct {
	ShouldStop bool
	Reason     string
}

// evaluateAutoStop returns whether the bot should stop based on session PnL and execution config.
// Session PnL is cumulative PnL since the run started (totalPnL - baseline).
func evaluateAutoStop(sessionPnL decimal.Decimal, cfg ExecutionConfig) autoStopEvaluation {
	mode := cfg.AutoStopMode
	if mode == "" {
		mode = AutoStopFirstHit
	}

	target := decimal.NewFromFloat(cfg.TargetPayoutUsd)
	bankroll := cfg.PaperBankroll
	if bankroll <= 0 {
		bankroll = 10000
	}
	riskPct := cfg.RiskTolerancePercent
	if riskPct < 0 {
		riskPct = 0
	}
	if riskPct > 100 {
		riskPct = 100
	}
	maxLoss := decimal.NewFromFloat(bankroll * (riskPct / 100.0))

	hasTarget := target.GreaterThan(decimal.Zero)
	hasRisk := maxLoss.GreaterThan(decimal.Zero)

	if !hasTarget && !hasRisk {
		return autoStopEvaluation{ShouldStop: false}
	}

	hitTarget := hasTarget && sessionPnL.GreaterThanOrEqual(target)
	// Loss: session PnL <= -maxLoss
	hitRisk := hasRisk && sessionPnL.LessThanOrEqual(maxLoss.Neg())

	switch mode {
	case AutoStopTargetOnly:
		if hitTarget {
			return autoStopEvaluation{ShouldStop: true, Reason: StopReasonTargetPayout}
		}
		return autoStopEvaluation{ShouldStop: false}
	case AutoStopRiskOnly:
		if hitRisk {
			return autoStopEvaluation{ShouldStop: true, Reason: StopReasonRiskLimit}
		}
		return autoStopEvaluation{ShouldStop: false}
	default: // first_hit
		if hitTarget && hitRisk {
			// Both in one tick is unlikely; prefer profit target if both (arbitrary tie-break)
			return autoStopEvaluation{ShouldStop: true, Reason: StopReasonTargetPayout}
		}
		if hitTarget {
			return autoStopEvaluation{ShouldStop: true, Reason: StopReasonTargetPayout}
		}
		if hitRisk {
			return autoStopEvaluation{ShouldStop: true, Reason: StopReasonRiskLimit}
		}
		return autoStopEvaluation{ShouldStop: false}
	}
}
