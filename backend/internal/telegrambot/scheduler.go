package telegrambot

import (
	"context"
	"fmt"
	"strings"

	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
)

// Scheduler wraps robfig/cron with our job definitions.
type Scheduler struct {
	log      *zap.Logger
	cron     *cron.Cron
	q        *Queries
	b        *Broadcaster
	ogBase   string
	frontend string
}

// NewScheduler returns a configured scheduler. All cron expressions are UTC.
func NewScheduler(log *zap.Logger, q *Queries, b *Broadcaster, ogBase, frontend string) *Scheduler {
	if log == nil {
		log = zap.NewNop()
	}
	return &Scheduler{
		log:      log,
		cron:     cron.New(cron.WithLocation(utcLocation())),
		q:        q,
		b:        b,
		ogBase:   ogBase,
		frontend: frontend,
	}
}

// Start registers jobs and begins ticking.
func (s *Scheduler) Start(ctx context.Context) {
	jobs := []struct {
		spec string
		name string
		fn   func(context.Context)
	}{
		{"0 9,21 * * *", "daily_leaderboard", s.dailyLeaderboard},
		{"0 7 * * *", "morning_news", s.morningNews},
		{"0 18 * * SUN", "weekly_recap", s.weeklyRecap},
		{"0 12 * * MON", "bot_board", s.botBoard},
	}
	for _, j := range jobs {
		j := j
		_, err := s.cron.AddFunc(j.spec, func() {
			// use a fresh short context per job; the broadcaster holds its own.
			cctx, cancel := context.WithTimeout(ctx, 30*1000*1000*1000 /*30s*/)
			defer cancel()
			s.log.Info("cron job running", zap.String("name", j.name))
			j.fn(cctx)
		})
		if err != nil {
			s.log.Error("cron.AddFunc failed", zap.String("spec", j.spec), zap.Error(err))
		}
	}
	s.cron.Start()
	s.log.Info("scheduler started")
}

// Stop drains the scheduler.
func (s *Scheduler) Stop(ctx context.Context) {
	done := s.cron.Stop().Done()
	select {
	case <-done:
	case <-ctx.Done():
	}
}

// ------- job impls -------

func (s *Scheduler) dailyLeaderboard(ctx context.Context) {
	compID, compName, shareURL, rows, err := s.q.LeaderboardTopForActive(ctx)
	if err != nil {
		s.log.Warn("leaderboard query failed", zap.Error(err))
		return
	}
	if compID == "" || len(rows) == 0 {
		s.log.Info("no active competition for daily leaderboard; skipping")
		return
	}
	payload := map[string]any{
		"comp_id":   compID,
		"comp_name": compName,
		"row_count": len(rows),
		"date":      truncDay(),
	}
	text := renderDailyLeaderboard(compName, rows, shareURL)
	buttons := [][]InlineButton{}
	if u := safeURL(shareURL); u != "" {
		buttons = append(buttons, []InlineButton{{Text: "Open Arena", URL: u}})
	}
	s.b.Enqueue(Post{
		Kind:      PillarDailyLeaderboard,
		DedupeKey: dedupeKey(PillarDailyLeaderboard, payload),
		Text:      text,
		ImageURL:  ogCardURL(s.ogBase, "leaderboard", map[string]string{"competitionId": compID}),
		Buttons:   buttons,
		Payload:   payload,
	})
}

func (s *Scheduler) morningNews(ctx context.Context) {
	// Keep this conservative: only post a static headline pointing at the Arena.
	// tradingbot/news_collector API surface is not wired into this package,
	// so we avoid cross-module coupling - a richer headline source can be
	// plugged in later without schema changes.
	payload := map[string]any{
		"kind": "morning_news",
		"date": truncDay(),
	}
	text := renderMarketNews(
		"Deriv Arena Morning Brief",
		"Check today's live competitions and community bot performance.",
	)
	s.b.Enqueue(Post{
		Kind:      PillarMarketNews,
		DedupeKey: dedupeKey(PillarMarketNews, payload),
		Text:      text,
		ImageURL:  ogCardURL(s.ogBase, "leaderboard", nil),
		Buttons: [][]InlineButton{{
			{Text: "Open Arena", URL: s.frontend + "/arena"},
		}},
		Payload: payload,
	})
}

func (s *Scheduler) weeklyRecap(ctx context.Context) {
	totalComps, totalParticipants, topName, topSortino, err := s.q.WeeklyRecapStats(ctx)
	if err != nil {
		s.log.Warn("weekly recap query failed", zap.Error(err))
		return
	}
	if totalComps == 0 && totalParticipants == 0 {
		s.log.Info("no weekly data; skipping recap")
		return
	}
	payload := map[string]any{
		"total_comps":        totalComps,
		"total_participants": totalParticipants,
		"top_name":           topName,
		"top_sortino":        fmt.Sprintf("%.2f", topSortino),
		"week":               weekStamp(),
	}
	s.b.Enqueue(Post{
		Kind:      PillarWeeklyRecap,
		DedupeKey: dedupeKey(PillarWeeklyRecap, payload),
		Text:      renderWeeklyRecap(totalComps, totalParticipants, topName, topSortino),
		ImageURL:  ogCardURL(s.ogBase, "leaderboard", map[string]string{"range": "week"}),
		Buttons: [][]InlineButton{{
			{Text: "Full recap", URL: s.frontend + "/leaderboard"},
		}},
		Payload: payload,
	})
}

func (s *Scheduler) botBoard(ctx context.Context) {
	rows, err := s.q.WeeklyTopBots(ctx, 5)
	if err != nil {
		s.log.Warn("weekly top-bots query failed", zap.Error(err))
		return
	}
	if len(rows) == 0 {
		s.log.Info("no top bots this week; skipping")
		return
	}
	names := make([]string, 0, len(rows))
	for _, r := range rows {
		names = append(names, r.Name)
	}
	payload := map[string]any{
		"names": strings.Join(names, ","),
		"week":  weekStamp(),
	}
	s.b.Enqueue(Post{
		Kind:      PillarBotBoard,
		DedupeKey: dedupeKey(PillarBotBoard, payload),
		Text:      renderBotBoard(rows),
		ImageURL:  ogCardURL(s.ogBase, "bot-board", nil),
		Buttons: [][]InlineButton{{
			{Text: "Explore bots", URL: s.frontend + "/dashboard"},
		}},
		Payload: payload,
	})
}
