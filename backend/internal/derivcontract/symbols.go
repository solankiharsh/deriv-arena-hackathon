// Package derivcontract centralizes Deriv V2 symbol mapping and validation
// for both public market data and authenticated trading.
package derivcontract

import (
	"fmt"
	"strings"
)

// Known volatility synthetic symbols (Deriv ↔ canonical VOL*-USD).
var derivVolToCanonical = map[string]string{
	"1HZ10V":  "VOL10-USD",
	"1HZ25V":  "VOL25-USD",
	"1HZ50V":  "VOL50-USD",
	"1HZ75V":  "VOL75-USD",
	"1HZ100V": "VOL100-USD",
	"1HZ150V": "VOL150-USD",
	"1HZ250V": "VOL250-USD",
}

var canonicalVolToDeriv = map[string]string{
	"VOL10-USD":  "1HZ10V",
	"VOL25-USD":  "1HZ25V",
	"VOL50-USD":  "1HZ50V",
	"VOL75-USD":  "1HZ75V",
	"VOL100-USD": "1HZ100V",
	"VOL150-USD": "1HZ150V",
	"VOL250-USD": "1HZ250V",
}

// DerivToCanonical maps a Deriv underlying symbol to canonical pair form (e.g. 1HZ100V → VOL100-USD).
func DerivToCanonical(derivSymbol string) string {
	if c, ok := derivVolToCanonical[derivSymbol]; ok {
		return c
	}
	if derivSymbol == "" {
		return ""
	}
	// Unknown: treat as BASE-USD for display (caller may further validate).
	return derivSymbol + "-USD"
}

// CanonicalToDeriv maps canonical pair (e.g. VOL100-USD) to Deriv symbol, or returns raw Deriv if already valid.
func CanonicalToDeriv(canonicalOrDeriv string) (string, error) {
	s := strings.TrimSpace(canonicalOrDeriv)
	if s == "" {
		return "", fmt.Errorf("derivcontract: empty symbol")
	}
	if d, ok := canonicalVolToDeriv[s]; ok {
		return d, nil
	}
	// Already a known Deriv vol symbol
	if _, ok := derivVolToCanonical[s]; ok {
		return s, nil
	}
	// VOL100 (no suffix)
	if strings.HasPrefix(s, "VOL") && !strings.Contains(s, "-") {
		pair := s + "-USD"
		if d, ok := canonicalVolToDeriv[pair]; ok {
			return d, nil
		}
	}
	// Generic *-USD → strip suffix if safe
	if strings.HasSuffix(s, "-USD") && len(s) > 4 {
		base := strings.TrimSuffix(s, "-USD")
		if base == "" {
			return "", fmt.Errorf("derivcontract: invalid canonical %q", canonicalOrDeriv)
		}
		// Vol indices must use explicit map; arbitrary bases are not allowlisted here.
		if d, ok := canonicalVolToDeriv[s]; ok {
			return d, nil
		}
		return base, nil
	}
	return s, nil
}

// PairToDeriv maps internal pair like VOL100-USD to Deriv symbol 1HZ100V.
func PairToDeriv(pair string) (string, error) {
	p := strings.TrimSpace(pair)
	if p == "" {
		return "", fmt.Errorf("derivcontract: empty pair")
	}
	if d, ok := canonicalVolToDeriv[p]; ok {
		return d, nil
	}
	// VOL100 without -USD
	if strings.HasPrefix(p, "VOL") && strings.HasSuffix(p, "-USD") == false {
		return PairToDeriv(p + "-USD")
	}
	symbol := strings.TrimSuffix(p, "-USD")
	switch symbol {
	case "VOL10", "1HZ10V":
		return "1HZ10V", nil
	case "VOL25", "1HZ25V":
		return "1HZ25V", nil
	case "VOL50", "1HZ50V":
		return "1HZ50V", nil
	case "VOL75", "1HZ75V":
		return "1HZ75V", nil
	case "VOL100", "1HZ100V":
		return "1HZ100V", nil
	case "VOL150", "1HZ150V":
		return "1HZ150V", nil
	case "VOL250", "1HZ250V":
		return "1HZ250V", nil
	default:
		if symbol == "" {
			return "", fmt.Errorf("derivcontract: unmappable pair %q", pair)
		}
		return symbol, nil
	}
}

// ValidateDerivUnderlying allowlists volatility indices for competition defaults; extend as product grows.
func ValidateDerivUnderlying(deriv string) error {
	d := strings.TrimSpace(deriv)
	if d == "" {
		return fmt.Errorf("derivcontract: underlying symbol required")
	}
	if _, ok := derivVolToCanonical[d]; ok {
		return nil
	}
	// Allow any non-empty Deriv symbol for forward compatibility if explicitly passed (API may send full symbol).
	if len(d) > 64 || strings.ContainsAny(d, " \t\n\r") {
		return fmt.Errorf("derivcontract: invalid underlying symbol")
	}
	return nil
}
