package competition

import (
	"github.com/shopspring/decimal"
)

// maxDrawdownPctAlongPath computes peak-to-trough drawdown as a percent of the running peak,
// along the equity path: startingBalance + cumulative pnls, then additionalPnL.
func maxDrawdownPctAlongPath(startingBalance decimal.Decimal, priorPnls []decimal.Decimal, additionalPnL decimal.Decimal) decimal.Decimal {
	eq := startingBalance
	peak := startingBalance
	maxDD := decimal.Zero
	hundred := decimal.NewFromInt(100)

	apply := func(p decimal.Decimal) {
		eq = eq.Add(p)
		if eq.GreaterThan(peak) {
			peak = eq
		}
		if peak.IsPositive() {
			dd := peak.Sub(eq).Div(peak).Mul(hundred)
			if dd.GreaterThan(maxDD) {
				maxDD = dd
			}
		}
	}
	for i := range priorPnls {
		apply(priorPnls[i])
	}
	apply(additionalPnL)
	return maxDD
}
