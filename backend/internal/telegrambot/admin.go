package telegrambot

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"time"
)

// AdminAuth returns a middleware enforcing bearer-token auth via ADMIN_API_KEY.
// If adminKey is empty, every request is rejected with 503 so misconfiguration
// fails closed (defense in depth).
func AdminAuth(adminKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if adminKey == "" {
				http.Error(w, "admin api disabled", http.StatusServiceUnavailable)
				return
			}
			got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			// Length-equality check before constant-time compare to avoid
			// leaking length information yet allow the compare to run.
			if len(got) != len(adminKey) {
				// Still spend roughly equivalent time to dampen timing oracle.
				_ = subtle.ConstantTimeCompare([]byte(adminKey), []byte(adminKey))
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			if subtle.ConstantTimeCompare([]byte(got), []byte(adminKey)) != 1 {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// confirmToken stores a pending announce preview keyed by a random token.
type confirmToken struct {
	payloadHash string
	post        Post
	expires     time.Time
}

// confirmStore is a small in-memory map with mutex. 5-min TTL per entry.
// In-process only - acceptable because this runs in a single-instance backend.
type confirmStore struct {
	mu     sync.Mutex
	byToken map[string]confirmToken
}

func newConfirmStore() *confirmStore {
	return &confirmStore{byToken: make(map[string]confirmToken)}
}

// put stores an entry and returns the token string.
func (c *confirmStore) put(post Post, payloadHash string, ttl time.Duration) (string, error) {
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	token := base64.RawURLEncoding.EncodeToString(buf[:])
	c.mu.Lock()
	defer c.mu.Unlock()
	// GC while holding the lock - cheap because N is small.
	now := time.Now()
	for t, e := range c.byToken {
		if e.expires.Before(now) {
			delete(c.byToken, t)
		}
	}
	c.byToken[token] = confirmToken{
		payloadHash: payloadHash,
		post:        post,
		expires:     now.Add(ttl),
	}
	return token, nil
}

// take atomically consumes a token (one-shot).
func (c *confirmStore) take(token, payloadHash string) (Post, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.byToken[token]
	if !ok {
		return Post{}, false
	}
	delete(c.byToken, token)
	if time.Now().After(e.expires) {
		return Post{}, false
	}
	if subtle.ConstantTimeCompare([]byte(e.payloadHash), []byte(payloadHash)) != 1 {
		return Post{}, false
	}
	return e.post, true
}

// tokenBucket is a tiny per-key rate limiter used for the admin endpoints.
// 5 req/min is enforced by allowing 5 tokens refilled 1 per 12s.
type tokenBucket struct {
	mu        sync.Mutex
	tokens    map[string]float64
	lastRefill map[string]time.Time
	rate      float64 // tokens per second
	burst     float64
}

func newTokenBucket(ratePerMin, burst int) *tokenBucket {
	return &tokenBucket{
		tokens:     make(map[string]float64),
		lastRefill: make(map[string]time.Time),
		rate:       float64(ratePerMin) / 60.0,
		burst:      float64(burst),
	}
}

func (t *tokenBucket) allow(key string) bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := time.Now()
	last, ok := t.lastRefill[key]
	if !ok {
		t.tokens[key] = t.burst
		t.lastRefill[key] = now
	} else {
		elapsed := now.Sub(last).Seconds()
		t.tokens[key] = minFloat(t.burst, t.tokens[key]+elapsed*t.rate)
		t.lastRefill[key] = now
	}
	if t.tokens[key] < 1 {
		return false
	}
	t.tokens[key]--
	return true
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// writeJSONErr writes a small JSON error.
func writeJSONErr(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
