package telegrambot

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Queries is a thin read-only layer over existing DerivArena tables.
// All SQL uses parameterized arguments; no string concatenation.
type Queries struct {
	pool *pgxpool.Pool
}

// NewQueries builds a Queries.
func NewQueries(pool *pgxpool.Pool) *Queries {
	return &Queries{pool: pool}
}

// LeaderboardTopForActive returns top-5 (display_name, sortino) across the
// most recently-active competition. Returns (compID, compName, rows).
// If no active competition exists, returns empty values (not an error).
func (q *Queries) LeaderboardTopForActive(ctx context.Context) (compID, compName, shareURL string, rows []LeaderboardRow, err error) {
	err = q.pool.QueryRow(ctx, `
		SELECT id::text, COALESCE(name,''), COALESCE(share_url,'')
		FROM competitions
		WHERE status = 'active'
		ORDER BY start_time DESC NULLS LAST, created_at DESC
		LIMIT 1
	`).Scan(&compID, &compName, &shareURL)
	if err != nil {
		// Not an error if no active competition; signal via empty compID.
		return "", "", "", nil, nil
	}

	r, err := q.pool.Query(ctx, `
		SELECT COALESCE(p.trader_name, p.trader_id) AS display_name,
		       COALESCE(cs.sortino_ratio, 0)::float8 AS sortino
		FROM participants p
		JOIN competition_stats cs ON cs.participant_id = p.id
		WHERE p.competition_id = $1
		ORDER BY cs.sortino_ratio DESC NULLS LAST
		LIMIT 5
	`, compID)
	if err != nil {
		return compID, compName, shareURL, nil, err
	}
	defer r.Close()

	rank := 0
	for r.Next() {
		rank++
		var name string
		var s float64
		if err := r.Scan(&name, &s); err != nil {
			return compID, compName, shareURL, nil, err
		}
		rows = append(rows, LeaderboardRow{Rank: rank, DisplayName: name, Sortino: s})
	}
	return compID, compName, shareURL, rows, r.Err()
}

// NewCompetition describes a newly-opened competition row for the poller.
type NewCompetition struct {
	ID        string
	Name      string
	ShareURL  string
	Duration  int
	CreatedAt time.Time
}

// NewCompetitionsSince returns competitions created after cursor, status='active'.
func (q *Queries) NewCompetitionsSince(ctx context.Context, cursor time.Time) ([]NewCompetition, error) {
	r, err := q.pool.Query(ctx, `
		SELECT id::text, COALESCE(name,''), COALESCE(share_url,''),
		       COALESCE(duration_hours, 0), created_at
		FROM competitions
		WHERE created_at > $1
		  AND status IN ('active','pending')
		ORDER BY created_at ASC
		LIMIT 20
	`, cursor)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	var out []NewCompetition
	for r.Next() {
		var c NewCompetition
		if err := r.Scan(&c.ID, &c.Name, &c.ShareURL, &c.Duration, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, r.Err()
}

// BigWin describes a large closed bot trade.
type BigWin struct {
	TradeID  string
	BotName  string
	Symbol   string
	PnL      float64
	ClosedAt time.Time
}

// BigWinsSince returns closed bot_trades with pnl >= threshold after cursor.
func (q *Queries) BigWinsSince(ctx context.Context, cursor time.Time, minPnL float64) ([]BigWin, error) {
	r, err := q.pool.Query(ctx, `
		SELECT bt.id::text,
		       COALESCE(b.name,'bot'),
		       COALESCE(bt.symbol,''),
		       COALESCE(bt.pnl, 0)::float8,
		       bt.closed_at
		FROM bot_trades bt
		JOIN trading_bots b ON b.id = bt.bot_id
		WHERE bt.closed_at IS NOT NULL
		  AND bt.closed_at > $1
		  AND bt.pnl >= $2
		ORDER BY bt.closed_at ASC
		LIMIT 20
	`, cursor, minPnL)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	var out []BigWin
	for r.Next() {
		var w BigWin
		if err := r.Scan(&w.TradeID, &w.BotName, &w.Symbol, &w.PnL, &w.ClosedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, r.Err()
}

// CatalogItem describes a new Miles catalog entry.
type CatalogItem struct {
	ID        string
	Name      string
	MilesCost float64
	CreatedAt time.Time
}

// CatalogItemsSince returns catalog rows created after cursor.
func (q *Queries) CatalogItemsSince(ctx context.Context, cursor time.Time) ([]CatalogItem, error) {
	r, err := q.pool.Query(ctx, `
		SELECT id, COALESCE(name,''), COALESCE(miles_cost,0)::float8, created_at
		FROM deriv_miles_catalog
		WHERE created_at > $1
		  AND available = true
		ORDER BY created_at ASC
		LIMIT 20
	`, cursor)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	var out []CatalogItem
	for r.Next() {
		var c CatalogItem
		if err := r.Scan(&c.ID, &c.Name, &c.MilesCost, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, r.Err()
}

// WeeklyTopBots returns the top bots by total_pnl from bot_analytics.
func (q *Queries) WeeklyTopBots(ctx context.Context, limit int) ([]BotBoardRow, error) {
	if limit <= 0 {
		limit = 5
	}
	r, err := q.pool.Query(ctx, `
		SELECT COALESCE(b.name,'bot'),
		       COALESCE(ba.total_pnl,0)::float8,
		       COALESCE(ba.win_rate,0)::float8
		FROM bot_analytics ba
		JOIN trading_bots b ON b.id = ba.bot_id
		WHERE ba.last_trade_at IS NOT NULL
		  AND ba.last_trade_at > NOW() - INTERVAL '7 days'
		ORDER BY ba.total_pnl DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	var out []BotBoardRow
	rank := 0
	for r.Next() {
		rank++
		var row BotBoardRow
		if err := r.Scan(&row.Name, &row.TotalPnL, &row.WinRate); err != nil {
			return nil, err
		}
		row.Rank = rank
		out = append(out, row)
	}
	return out, r.Err()
}

// WeeklyRecapStats returns (totalCompetitions, totalParticipants, topName, topSortino).
func (q *Queries) WeeklyRecapStats(ctx context.Context) (totalComps, totalParticipants int, topName string, topSortino float64, err error) {
	err = q.pool.QueryRow(ctx, `
		SELECT COUNT(DISTINCT c.id)
		FROM competitions c
		WHERE c.created_at > NOW() - INTERVAL '7 days'
	`).Scan(&totalComps)
	if err != nil {
		return 0, 0, "", 0, err
	}
	err = q.pool.QueryRow(ctx, `
		SELECT COUNT(p.id)
		FROM participants p
		JOIN competitions c ON c.id = p.competition_id
		WHERE c.created_at > NOW() - INTERVAL '7 days'
	`).Scan(&totalParticipants)
	if err != nil {
		return 0, 0, "", 0, err
	}
	var name *string
	var s *float64
	err = q.pool.QueryRow(ctx, `
		SELECT COALESCE(p.trader_name, p.trader_id), cs.sortino_ratio::float8
		FROM competition_stats cs
		JOIN participants p ON p.id = cs.participant_id
		JOIN competitions c ON c.id = p.competition_id
		WHERE c.created_at > NOW() - INTERVAL '7 days'
		  AND cs.sortino_ratio IS NOT NULL
		ORDER BY cs.sortino_ratio DESC
		LIMIT 1
	`).Scan(&name, &s)
	if err != nil {
		// Acceptable - may have no winners this week.
		return totalComps, totalParticipants, "", 0, nil
	}
	if name != nil {
		topName = *name
	}
	if s != nil {
		topSortino = *s
	}
	return totalComps, totalParticipants, topName, topSortino, nil
}
