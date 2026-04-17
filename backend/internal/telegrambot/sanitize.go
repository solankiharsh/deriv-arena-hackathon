package telegrambot

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"html"
	"regexp"
	"sort"
	"strings"
)

// nameAllowlist is the allowlist for user-origin short strings (display_name,
// competition name, bot name, catalog name). Unicode letters + digits + a few
// safe punctuation characters. Length 1-64.
var nameAllowlist = regexp.MustCompile(`^[\p{L}\p{N}_\-. ]{1,64}$`)

// titleAllowlist is slightly wider for admin-provided titles.
var titleAllowlist = regexp.MustCompile(`^[\p{L}\p{N}\p{P}\p{Zs}]{1,120}$`)

// safeName HTML-escapes and enforces the allowlist. Values that fail become
// "(hidden)" so bad data cannot break a post.
func safeName(s string) string {
	s = strings.TrimSpace(s)
	if s == "" || !nameAllowlist.MatchString(s) {
		return "(hidden)"
	}
	return html.EscapeString(s)
}

// safeTitle is for admin-supplied titles. Max 120 chars, HTML escaped.
func safeTitle(s string) string {
	s = strings.TrimSpace(s)
	if s == "" || !titleAllowlist.MatchString(s) {
		return ""
	}
	return html.EscapeString(s)
}

// safeBody HTML-escapes a body paragraph. Caps at 1000 chars.
func safeBody(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 1000 {
		s = s[:1000]
	}
	return html.EscapeString(s)
}

// allowedHostPrefix is the only scheme+host prefix we allow on URLs that go
// into inline buttons or post text.
var allowedURLPattern = regexp.MustCompile(
	`^https://(frontend-preethi-3498s-projects\.vercel\.app|t\.me/DerivArenaAsk)(/.*)?$`,
)

// safeURL returns the URL unchanged if it matches the allowlist, else "".
func safeURL(u string) string {
	u = strings.TrimSpace(u)
	if !allowedURLPattern.MatchString(u) {
		return ""
	}
	return u
}

// dedupeKey builds a stable SHA256 hex digest from kind + canonical payload.
// Sort map keys so {a:1,b:2} and {b:2,a:1} hash identically.
func dedupeKey(kind string, payload map[string]any) string {
	canonical := canonicalize(payload)
	h := sha256.New()
	h.Write([]byte(kind))
	h.Write([]byte{0})
	h.Write([]byte(canonical))
	return hex.EncodeToString(h.Sum(nil))
}

// canonicalize produces deterministic JSON with sorted keys.
func canonicalize(v any) string {
	switch x := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			kb, _ := json.Marshal(k)
			parts = append(parts, string(kb)+":"+canonicalize(x[k]))
		}
		return "{" + strings.Join(parts, ",") + "}"
	case []any:
		parts := make([]string, len(x))
		for i := range x {
			parts[i] = canonicalize(x[i])
		}
		return "[" + strings.Join(parts, ",") + "]"
	default:
		b, _ := json.Marshal(v)
		return string(b)
	}
}
