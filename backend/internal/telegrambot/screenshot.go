package telegrambot

import (
	"net/url"
	"strings"
)

// ogCardURL builds an absolute URL to an @vercel/og route. The base is fixed
// server-side, so no user input can redirect the request elsewhere.
// Params are URL-encoded; callers must only pass server-controlled values.
func ogCardURL(ogBase, card string, params map[string]string) string {
	base := strings.TrimRight(ogBase, "/")
	// Allowlist of valid card names. Anything else returns "" so the broadcaster
	// falls back to sendMessage (text-only).
	switch card {
	case "leaderboard", "competition", "miles-item", "bot-board":
	default:
		return ""
	}
	u := base + "/api/og/" + card
	if len(params) == 0 {
		return u
	}
	q := url.Values{}
	for k, v := range params {
		q.Set(k, v)
	}
	return u + "?" + q.Encode()
}
