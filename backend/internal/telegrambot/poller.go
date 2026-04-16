package telegrambot

import (
	"context"
	"time"

	"go.uber.org/zap"
)

// Poller scans the DB at fixed intervals and enqueues posts for new rows.
type Poller struct {
	log       *zap.Logger
	q         *Queries
	store     *Store
	b         *Broadcaster
	ogBase    string
	frontend  string
	bigWinMin float64
}

// NewPoller builds a poller.
func NewPoller(log *zap.Logger, q *Queries, store *Store, b *Broadcaster, ogBase, frontend string, bigWinMin float64) *Poller {
	if log == nil {
		log = zap.NewNop()
	}
	if bigWinMin <= 0 {
		bigWinMin = 100
	}
	return &Poller{
		log:       log,
		q:         q,
		store:     store,
		b:         b,
		ogBase:    ogBase,
		frontend:  frontend,
		bigWinMin: bigWinMin,
	}
}

// Run ticks until ctx is cancelled.
func (p *Poller) Run(ctx context.Context) {
	fast := time.NewTicker(60 * time.Second)
	slow := time.NewTicker(5 * time.Minute)
	defer fast.Stop()
	defer slow.Stop()

	// Prime cursors to NOW on first run if empty, so we never replay old data.
	p.primeCursorsIfEmpty(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-fast.C:
			p.pollCompetitions(ctx)
			p.pollBigWins(ctx)
		case <-slow.C:
			p.pollCatalog(ctx)
		}
	}
}

func (p *Poller) primeCursorsIfEmpty(ctx context.Context) {
	now := time.Now().UTC()
	for _, pillar := range []string{PillarLiveCompetition, PillarBigWin, PillarCatalogDrop} {
		ts, _, err := p.store.GetCursor(ctx, pillar)
		if err != nil {
			p.log.Warn("prime cursor read failed", zap.String("pillar", pillar), zap.Error(err))
			continue
		}
		if ts.IsZero() {
			if err := p.store.UpsertCursor(ctx, pillar, now, ""); err != nil {
				p.log.Warn("prime cursor write failed", zap.String("pillar", pillar), zap.Error(err))
			}
		}
	}
}

func (p *Poller) pollCompetitions(ctx context.Context) {
	cursor, _, err := p.store.GetCursor(ctx, PillarLiveCompetition)
	if err != nil {
		p.log.Warn("cursor read failed", zap.String("pillar", PillarLiveCompetition), zap.Error(err))
		return
	}
	rows, err := p.q.NewCompetitionsSince(ctx, cursor)
	if err != nil {
		p.log.Warn("new-competitions query failed", zap.Error(err))
		return
	}
	if len(rows) == 0 {
		return
	}
	for _, c := range rows {
		payload := map[string]any{
			"id":       c.ID,
			"name":     c.Name,
			"duration": c.Duration,
		}
		buttons := [][]InlineButton{}
		if u := safeURL(c.ShareURL); u != "" {
			buttons = append(buttons, []InlineButton{{Text: "Join now", URL: u}})
		}
		p.b.Enqueue(Post{
			Kind:      PillarLiveCompetition,
			DedupeKey: dedupeKey(PillarLiveCompetition, payload),
			Text:      renderLiveCompetition(c.Name, c.Duration, c.ShareURL),
			ImageURL:  ogCardURL(p.ogBase, "competition", map[string]string{"id": c.ID}),
			Buttons:   buttons,
			Payload:   payload,
		})
	}
	last := rows[len(rows)-1]
	if err := p.store.UpsertCursor(ctx, PillarLiveCompetition, last.CreatedAt, last.ID); err != nil {
		p.log.Warn("cursor write failed", zap.String("pillar", PillarLiveCompetition), zap.Error(err))
	}
}

func (p *Poller) pollBigWins(ctx context.Context) {
	cursor, _, err := p.store.GetCursor(ctx, PillarBigWin)
	if err != nil {
		p.log.Warn("cursor read failed", zap.String("pillar", PillarBigWin), zap.Error(err))
		return
	}
	rows, err := p.q.BigWinsSince(ctx, cursor, p.bigWinMin)
	if err != nil {
		p.log.Warn("big-wins query failed", zap.Error(err))
		return
	}
	if len(rows) == 0 {
		return
	}
	for _, w := range rows {
		payload := map[string]any{
			"trade_id": w.TradeID,
			"bot":      w.BotName,
			"symbol":   w.Symbol,
			"pnl":      w.PnL,
		}
		p.b.Enqueue(Post{
			Kind:      PillarBigWin,
			DedupeKey: dedupeKey(PillarBigWin, payload),
			Text:      renderBigWin(w.BotName, w.Symbol, w.PnL),
			ImageURL:  ogCardURL(p.ogBase, "bot-board", map[string]string{"highlight": w.BotName}),
			Buttons: [][]InlineButton{{
				{Text: "Open Arena", URL: p.frontend + "/arena"},
			}},
			Payload: payload,
		})
	}
	last := rows[len(rows)-1]
	if err := p.store.UpsertCursor(ctx, PillarBigWin, last.ClosedAt, last.TradeID); err != nil {
		p.log.Warn("cursor write failed", zap.String("pillar", PillarBigWin), zap.Error(err))
	}
}

func (p *Poller) pollCatalog(ctx context.Context) {
	cursor, _, err := p.store.GetCursor(ctx, PillarCatalogDrop)
	if err != nil {
		p.log.Warn("cursor read failed", zap.String("pillar", PillarCatalogDrop), zap.Error(err))
		return
	}
	rows, err := p.q.CatalogItemsSince(ctx, cursor)
	if err != nil {
		p.log.Warn("catalog query failed", zap.Error(err))
		return
	}
	if len(rows) == 0 {
		return
	}
	for _, c := range rows {
		payload := map[string]any{
			"id":    c.ID,
			"name":  c.Name,
			"cost":  c.MilesCost,
		}
		p.b.Enqueue(Post{
			Kind:      PillarCatalogDrop,
			DedupeKey: dedupeKey(PillarCatalogDrop, payload),
			Text:      renderCatalogDrop(c.Name, c.MilesCost),
			ImageURL:  ogCardURL(p.ogBase, "miles-item", map[string]string{"id": c.ID}),
			Buttons: [][]InlineButton{{
				{Text: "Open catalog", URL: p.frontend + "/miles"},
			}},
			Payload: payload,
		})
	}
	last := rows[len(rows)-1]
	if err := p.store.UpsertCursor(ctx, PillarCatalogDrop, last.CreatedAt, last.ID); err != nil {
		p.log.Warn("cursor write failed", zap.String("pillar", PillarCatalogDrop), zap.Error(err))
	}
}
