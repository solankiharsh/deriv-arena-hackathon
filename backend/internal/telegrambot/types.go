package telegrambot

import "time"

// Pillar names used as kind/cooldown keys. Keep stable; they are persisted.
const (
	PillarDailyLeaderboard  = "daily_leaderboard"
	PillarLiveCompetition   = "live_competition"
	PillarBigWin            = "big_win"
	PillarCatalogDrop       = "catalog_drop"
	PillarMarketNews        = "market_news"
	PillarWeeklyRecap       = "weekly_recap"
	PillarBotBoard          = "bot_board"
	PillarAdminAnnounce     = "admin_announce"
)

// AllPillars is the fixed enum used for validation.
var AllPillars = []string{
	PillarDailyLeaderboard,
	PillarLiveCompetition,
	PillarBigWin,
	PillarCatalogDrop,
	PillarMarketNews,
	PillarWeeklyRecap,
	PillarBotBoard,
	PillarAdminAnnounce,
}

// InlineButton renders into Telegram reply_markup JSON.
type InlineButton struct {
	Text string `json:"text"`
	URL  string `json:"url"`
}

// Post is the canonical queued broadcast.
type Post struct {
	Kind       string
	DedupeKey  string
	Text       string // HTML-escaped, Telegram parse_mode=HTML
	ImageURL   string // optional OG card URL
	Buttons    [][]InlineButton
	Payload    map[string]any // persisted as JSONB; must be free of secrets
	EnqueuedAt time.Time
}

// replyMarkupFromButtons builds Telegram inline_keyboard JSON.
func replyMarkupFromButtons(rows [][]InlineButton) map[string]any {
	if len(rows) == 0 {
		return nil
	}
	return map[string]any{"inline_keyboard": rows}
}
