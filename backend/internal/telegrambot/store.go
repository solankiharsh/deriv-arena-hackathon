package telegrambot

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store handles broadcast persistence and cursor tracking.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore builds a store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// ErrDuplicate signals the dedupe_key already existed.
var ErrDuplicate = errors.New("duplicate broadcast")

// Insert records a pending broadcast. Returns ErrDuplicate on 23505.
func (s *Store) Insert(ctx context.Context, dedupeKey, kind string, payload map[string]any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO telegram_broadcasts (dedupe_key, kind, payload)
		VALUES ($1, $2, $3)
	`, dedupeKey, kind, raw)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return ErrDuplicate
		}
		return err
	}
	return nil
}

// MarkSent updates message_id + sent_at.
func (s *Store) MarkSent(ctx context.Context, dedupeKey string, messageID int64) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE telegram_broadcasts
		SET message_id = $2, sent_at = NOW()
		WHERE dedupe_key = $1
	`, dedupeKey, messageID)
	return err
}

// MarkError records a delivery failure.
func (s *Store) MarkError(ctx context.Context, dedupeKey, errMsg string) error {
	// Truncate error to keep DB rows bounded.
	if len(errMsg) > 512 {
		errMsg = errMsg[:512]
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE telegram_broadcasts
		SET error = $2
		WHERE dedupe_key = $1
	`, dedupeKey, errMsg)
	return err
}

// LastSentAt returns the most recent sent_at for a pillar, or zero time.
// Used by the broadcaster per-pillar cooldown.
func (s *Store) LastSentAt(ctx context.Context, kind string) (time.Time, error) {
	var t *time.Time
	err := s.pool.QueryRow(ctx, `
		SELECT MAX(sent_at) FROM telegram_broadcasts
		WHERE kind = $1 AND sent_at IS NOT NULL
	`, kind).Scan(&t)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, err
	}
	if t == nil {
		return time.Time{}, nil
	}
	return *t, nil
}

// PostsInLastHour counts successful posts in the last 60 minutes.
func (s *Store) PostsInLastHour(ctx context.Context) (int, error) {
	var n int
	err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM telegram_broadcasts
		WHERE sent_at IS NOT NULL AND sent_at > NOW() - INTERVAL '1 hour'
	`).Scan(&n)
	return n, err
}

// GetMessageID returns the message_id for a dedupe_key (for deletes).
func (s *Store) GetMessageID(ctx context.Context, id string) (int64, error) {
	var mid *int64
	err := s.pool.QueryRow(ctx, `
		SELECT message_id FROM telegram_broadcasts
		WHERE id::text = $1 OR dedupe_key = $1
	`, id).Scan(&mid)
	if err != nil {
		return 0, err
	}
	if mid == nil {
		return 0, errors.New("no message_id")
	}
	return *mid, nil
}

// GetCursor reads a poller cursor; returns zero value on first run.
func (s *Store) GetCursor(ctx context.Context, pillar string) (lastTS time.Time, lastID string, err error) {
	var ts *time.Time
	var id *string
	err = s.pool.QueryRow(ctx, `
		SELECT last_seen_ts, last_seen_id FROM telegram_broadcast_cursors
		WHERE pillar = $1
	`, pillar).Scan(&ts, &id)
	if errors.Is(err, pgx.ErrNoRows) {
		return time.Time{}, "", nil
	}
	if err != nil {
		return time.Time{}, "", err
	}
	if ts != nil {
		lastTS = *ts
	}
	if id != nil {
		lastID = *id
	}
	return lastTS, lastID, nil
}

// UpsertCursor saves the latest cursor position.
func (s *Store) UpsertCursor(ctx context.Context, pillar string, lastTS time.Time, lastID string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO telegram_broadcast_cursors (pillar, last_seen_ts, last_seen_id, updated_at)
		VALUES ($1, $2, $3, NOW())
		ON CONFLICT (pillar) DO UPDATE
		SET last_seen_ts = EXCLUDED.last_seen_ts,
		    last_seen_id = EXCLUDED.last_seen_id,
		    updated_at   = NOW()
	`, pillar, nullTime(lastTS), nullString(lastID))
	return err
}

func nullTime(t time.Time) any {
	if t.IsZero() {
		return nil
	}
	return t
}

func nullString(s string) any {
	if s == "" {
		return nil
	}
	return s
}
