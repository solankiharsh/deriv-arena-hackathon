package derivcontract

import "testing"

func TestDerivToCanonical(t *testing.T) {
	if got := DerivToCanonical("1HZ100V"); got != "VOL100-USD" {
		t.Fatalf("got %q", got)
	}
	if got := DerivToCanonical("UNKNOWN"); got != "UNKNOWN-USD" {
		t.Fatalf("got %q", got)
	}
}

func TestPairToDeriv(t *testing.T) {
	d, err := PairToDeriv("VOL100-USD")
	if err != nil || d != "1HZ100V" {
		t.Fatalf("got %q err %v", d, err)
	}
	d, err = PairToDeriv("VOL100")
	if err != nil || d != "1HZ100V" {
		t.Fatalf("got %q err %v", d, err)
	}
}

func TestCanonicalToDeriv(t *testing.T) {
	d, err := CanonicalToDeriv("VOL75-USD")
	if err != nil || d != "1HZ75V" {
		t.Fatalf("got %q err %v", d, err)
	}
	d, err = CanonicalToDeriv("1HZ50V")
	if err != nil || d != "1HZ50V" {
		t.Fatalf("got %q err %v", d, err)
	}
}

func TestValidateDerivUnderlying(t *testing.T) {
	if err := ValidateDerivUnderlying("1HZ100V"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateDerivUnderlying(""); err == nil {
		t.Fatal("expected error")
	}
}
