package telegrambot

import (
	"fmt"
	"strings"
)

// LeaderboardRow is a pre-sanitized row rendered into the daily pulse.
type LeaderboardRow struct {
	Rank        int
	DisplayName string  // raw - will be safeName()'d here
	Sortino     float64 // rounded to 2dp
}

// renderDailyLeaderboard builds the HTML caption for the daily pulse.
func renderDailyLeaderboard(compName string, rows []LeaderboardRow, shareURL string) string {
	var b strings.Builder
	b.WriteString("<b>\xF0\x9F\x8F\x86 Daily Leaderboard Pulse</b>\n")
	b.WriteString(safeName(compName))
	b.WriteString("\n\n")
	medals := []string{"1.", "2.", "3.", "4.", "5."}
	for i, row := range rows {
		if i >= len(medals) {
			break
		}
		b.WriteString(medals[i])
		b.WriteString(" ")
		b.WriteString(safeName(row.DisplayName))
		b.WriteString("  <i>Sortino ")
		b.WriteString(fmt.Sprintf("%.2f", row.Sortino))
		b.WriteString("</i>\n")
	}
	if u := safeURL(shareURL); u != "" {
		b.WriteString("\nJoin the Arena: ")
		b.WriteString(u)
	}
	return b.String()
}

// renderLiveCompetition announces a newly-opened competition.
func renderLiveCompetition(compName string, durationHours int, shareURL string) string {
	var b strings.Builder
	b.WriteString("<b>\xE2\x9A\xA1 New Competition Opened</b>\n")
	b.WriteString(safeName(compName))
	b.WriteString("\n")
	if durationHours > 0 {
		b.WriteString(fmt.Sprintf("Duration: %d hour(s)\n", durationHours))
	}
	if u := safeURL(shareURL); u != "" {
		b.WriteString("\n")
		b.WriteString(u)
	}
	return b.String()
}

// renderBigWin announces a big-win trade.
func renderBigWin(botName, symbol string, pnl float64) string {
	var b strings.Builder
	b.WriteString("<b>\xF0\x9F\x94\xA5 Big Win</b>\n")
	b.WriteString(safeName(botName))
	b.WriteString(" just closed ")
	b.WriteString(safeName(symbol))
	b.WriteString(fmt.Sprintf(" for <b>$%.2f</b>.\n", pnl))
	return b.String()
}

// renderCatalogDrop announces a new Miles catalog item.
func renderCatalogDrop(name string, milesCost float64) string {
	var b strings.Builder
	b.WriteString("<b>\xF0\x9F\x8E\x81 New in Miles Catalog</b>\n")
	b.WriteString(safeName(name))
	b.WriteString(fmt.Sprintf("  <i>%.0f miles</i>\n", milesCost))
	return b.String()
}

// renderMarketNews renders the morning brief. News text is already trusted
// (from our own tradingbot/news_collector), but we still escape.
func renderMarketNews(headline, body string) string {
	var b strings.Builder
	b.WriteString("<b>\xF0\x9F\x93\xB0 Morning Market Brief</b>\n")
	b.WriteString(safeTitle(headline))
	b.WriteString("\n\n")
	b.WriteString(safeBody(body))
	return b.String()
}

// renderWeeklyRecap summarises the week.
func renderWeeklyRecap(totalCompetitions, totalParticipants int, topName string, topSortino float64) string {
	var b strings.Builder
	b.WriteString("<b>\xF0\x9F\x93\x8A Weekly Recap</b>\n")
	b.WriteString(fmt.Sprintf("Competitions: %d\n", totalCompetitions))
	b.WriteString(fmt.Sprintf("Total participants: %d\n", totalParticipants))
	if topName != "" {
		b.WriteString("\nMVP: ")
		b.WriteString(safeName(topName))
		b.WriteString(fmt.Sprintf("  <i>Sortino %.2f</i>", topSortino))
	}
	return b.String()
}

// BotBoardRow is a sanitized weekly-top row.
type BotBoardRow struct {
	Rank    int
	Name    string
	TotalPnL float64
	WinRate  float64 // 0..100
}

// renderBotBoard renders the Monday community-bot scoreboard.
func renderBotBoard(rows []BotBoardRow) string {
	var b strings.Builder
	b.WriteString("<b>\xF0\x9F\xA4\x96 Community Bot Scoreboard</b>\n")
	b.WriteString("Top community trading bots this week by PnL:\n\n")
	for i, row := range rows {
		if i >= 5 {
			break
		}
		b.WriteString(fmt.Sprintf("%d. %s  <i>PnL $%.2f • win %.1f%%</i>\n",
			row.Rank, safeName(row.Name), row.TotalPnL, row.WinRate))
	}
	return b.String()
}

// renderAdminAnnounce renders an admin-supplied title + body.
func renderAdminAnnounce(title, body string) string {
	var b strings.Builder
	if t := safeTitle(title); t != "" {
		b.WriteString("<b>")
		b.WriteString(t)
		b.WriteString("</b>\n\n")
	}
	b.WriteString(safeBody(body))
	return b.String()
}
