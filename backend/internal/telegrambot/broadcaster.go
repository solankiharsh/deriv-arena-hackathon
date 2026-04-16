package telegrambot

import (
	"context"
	"errors"
	"sync"
	"time"

	"go.uber.org/zap"
)

// Broadcaster owns the in-memory queue, rate limiter, and delivery loop.
type Broadcaster struct {
	log          *zap.Logger
	client       *Client
	store        *Store
	chatID       string
	queue        chan Post
	maxPerHour   int
	minInterval  time.Duration // global min gap between sends
	pillarCool   time.Duration // per-pillar cooldown
	lastSendMu   sync.Mutex
	lastSendTime time.Time
	fatalMu      sync.Mutex
	fatal        bool
}

// BroadcasterConfig holds tunables.
type BroadcasterConfig struct {
	ChatID         string
	MaxPostsPerHr  int
	MinInterval    time.Duration
	PillarCooldown time.Duration
	QueueSize      int
}

// NewBroadcaster builds a broadcaster.
func NewBroadcaster(log *zap.Logger, client *Client, store *Store, cfg BroadcasterConfig) *Broadcaster {
	if log == nil {
		log = zap.NewNop()
	}
	if cfg.QueueSize <= 0 {
		cfg.QueueSize = 512
	}
	if cfg.MinInterval <= 0 {
		cfg.MinInterval = 1 * time.Second
	}
	if cfg.PillarCooldown <= 0 {
		cfg.PillarCooldown = 10 * time.Minute
	}
	if cfg.MaxPostsPerHr <= 0 {
		cfg.MaxPostsPerHr = 8
	}
	return &Broadcaster{
		log:         log,
		client:      client,
		store:       store,
		chatID:      cfg.ChatID,
		queue:       make(chan Post, cfg.QueueSize),
		maxPerHour:  cfg.MaxPostsPerHr,
		minInterval: cfg.MinInterval,
		pillarCool:  cfg.PillarCooldown,
	}
}

// Enqueue drops a post onto the queue. Non-blocking: if queue is full the
// post is dropped and logged (we prefer drop over back-pressure on DB poller).
func (b *Broadcaster) Enqueue(post Post) {
	if post.DedupeKey == "" || post.Text == "" {
		b.log.Warn("rejecting empty post", zap.String("kind", post.Kind))
		return
	}
	post.EnqueuedAt = time.Now()
	select {
	case b.queue <- post:
	default:
		b.log.Warn("queue full, dropping post", zap.String("kind", post.Kind))
	}
}

// Run processes the queue until ctx is cancelled.
func (b *Broadcaster) Run(ctx context.Context) {
	b.log.Info("broadcaster started",
		zap.Int("queue_size", cap(b.queue)),
		zap.Int("max_per_hour", b.maxPerHour),
	)
	for {
		select {
		case <-ctx.Done():
			b.log.Info("broadcaster stopping")
			return
		case post := <-b.queue:
			b.handle(ctx, post)
		}
	}
}

// handle runs all gates, persists, sends, and records the result.
func (b *Broadcaster) handle(ctx context.Context, post Post) {
	if b.isFatal() {
		b.log.Warn("skipping post due to prior fatal error", zap.String("kind", post.Kind))
		return
	}

	// Global rate gate: count sent in last hour.
	count, err := b.store.PostsInLastHour(ctx)
	if err != nil {
		b.log.Warn("posts-in-last-hour check failed", zap.Error(err))
	} else if count >= b.maxPerHour {
		b.log.Info("hourly cap reached, dropping",
			zap.String("kind", post.Kind),
			zap.Int("count", count),
			zap.Int("max", b.maxPerHour),
		)
		return
	}

	// Per-pillar cooldown (scheduled-only; admin bypasses).
	if post.Kind != PillarAdminAnnounce {
		last, err := b.store.LastSentAt(ctx, post.Kind)
		if err != nil {
			b.log.Warn("last-sent check failed", zap.Error(err))
		} else if !last.IsZero() && time.Since(last) < b.pillarCool {
			b.log.Info("pillar cooldown active, dropping",
				zap.String("kind", post.Kind),
				zap.Duration("remaining", b.pillarCool-time.Since(last)),
			)
			return
		}
	}

	// Insert row first; dedupe via unique index.
	if err := b.store.Insert(ctx, post.DedupeKey, post.Kind, post.Payload); err != nil {
		if errors.Is(err, ErrDuplicate) {
			b.log.Info("duplicate dedupe_key, skipping",
				zap.String("kind", post.Kind),
				zap.String("dedupe_key", post.DedupeKey),
			)
			return
		}
		b.log.Warn("store insert failed", zap.Error(err))
		return
	}

	// Global min-interval between sends.
	b.waitMinInterval(ctx)

	replyMarkup := replyMarkupFromButtons(post.Buttons)

	var (
		msgID   int64
		sendErr error
	)
	if post.ImageURL != "" {
		msgID, sendErr = b.client.SendPhoto(ctx, b.chatID, post.ImageURL, post.Text, replyMarkup)
	}
	if post.ImageURL == "" || (sendErr != nil && !errors.Is(sendErr, ErrFatal) && !errors.Is(sendErr, ErrDisabled)) {
		// Fallback to text-only (or primary path when no image).
		msgID, sendErr = b.client.SendMessage(ctx, b.chatID, post.Text, replyMarkup)
	}

	if errors.Is(sendErr, ErrDisabled) {
		// Dry-run or missing token: record as sent with synthetic id for dedupe visibility.
		_ = b.store.MarkSent(ctx, post.DedupeKey, 0)
		b.log.Info("post processed (dry-run)", zap.String("kind", post.Kind))
		return
	}
	if errors.Is(sendErr, ErrFatal) {
		b.markFatal()
		_ = b.store.MarkError(ctx, post.DedupeKey, scrub(sendErr.Error()))
		return
	}
	if sendErr != nil {
		_ = b.store.MarkError(ctx, post.DedupeKey, scrub(sendErr.Error()))
		b.log.Warn("send failed",
			zap.String("kind", post.Kind),
			zap.String("dedupe_key", post.DedupeKey),
			zap.String("err", scrub(sendErr.Error())),
		)
		return
	}

	if err := b.store.MarkSent(ctx, post.DedupeKey, msgID); err != nil {
		b.log.Warn("mark-sent failed", zap.Error(err))
	}
	b.log.Info("post sent",
		zap.String("kind", post.Kind),
		zap.Int64("message_id", msgID),
		zap.String("dedupe_key", post.DedupeKey),
		zap.Duration("latency", time.Since(post.EnqueuedAt)),
	)
}

func (b *Broadcaster) waitMinInterval(ctx context.Context) {
	b.lastSendMu.Lock()
	elapsed := time.Since(b.lastSendTime)
	need := b.minInterval - elapsed
	b.lastSendTime = time.Now().Add(maxDuration(0, need))
	b.lastSendMu.Unlock()
	if need > 0 {
		select {
		case <-ctx.Done():
		case <-time.After(need):
		}
	}
}

func maxDuration(a, b time.Duration) time.Duration {
	if a > b {
		return a
	}
	return b
}

func (b *Broadcaster) markFatal() {
	b.fatalMu.Lock()
	b.fatal = true
	b.fatalMu.Unlock()
}

func (b *Broadcaster) isFatal() bool {
	b.fatalMu.Lock()
	defer b.fatalMu.Unlock()
	return b.fatal
}
