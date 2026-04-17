package tradingbot

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// Store handles all trading bot persistence.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new Store using the given pool.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// ---------- Bot CRUD ----------

// CreateBot inserts a new bot and initializes an analytics row.
func (s *Store) CreateBot(ctx context.Context, bot *Bot) error {
	configJSON, err := json.Marshal(bot.Config)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	featuresJSON, err := json.Marshal(bot.UnlockedFeatures)
	if err != nil {
		return fmt.Errorf("marshal features: %w", err)
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	query := `
		INSERT INTO trading_bots
			(user_id, name, status, execution_mode, config, level, xp, win_streak, best_streak, unlocked_features)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
		RETURNING id, created_at, updated_at
	`
	err = tx.QueryRow(ctx, query,
		bot.UserID, bot.Name, bot.Status, bot.ExecutionMode, configJSON,
		bot.Level, bot.XP, bot.WinStreak, bot.BestStreak, featuresJSON,
	).Scan(&bot.ID, &bot.CreatedAt, &bot.UpdatedAt)
	if err != nil {
		return fmt.Errorf("insert bot: %w", err)
	}

	_, err = tx.Exec(ctx, `INSERT INTO bot_analytics (bot_id) VALUES ($1) ON CONFLICT DO NOTHING`, bot.ID)
	if err != nil {
		return fmt.Errorf("init analytics: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

// GetBot fetches a bot by id, validating user ownership (IDOR protection).
func (s *Store) GetBot(ctx context.Context, botID, userID string) (*Bot, error) {
	query := `
		SELECT id, user_id, name, status, execution_mode, config,
		       level, xp, win_streak, best_streak, unlocked_features,
		       created_at, updated_at, started_at, stopped_at
		FROM trading_bots
		WHERE id = $1 AND user_id = $2
	`
	var b Bot
	var configJSON, featuresJSON []byte
	err := s.pool.QueryRow(ctx, query, botID, userID).Scan(
		&b.ID, &b.UserID, &b.Name, &b.Status, &b.ExecutionMode, &configJSON,
		&b.Level, &b.XP, &b.WinStreak, &b.BestStreak, &featuresJSON,
		&b.CreatedAt, &b.UpdatedAt, &b.StartedAt, &b.StoppedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("get bot: %w", err)
	}
	if err := json.Unmarshal(configJSON, &b.Config); err != nil {
		return nil, fmt.Errorf("unmarshal config: %w", err)
	}
	if err := json.Unmarshal(featuresJSON, &b.UnlockedFeatures); err != nil {
		b.UnlockedFeatures = []string{}
	}
	return &b, nil
}

// GetBotInternal fetches a bot by id without ownership check (for engine loops).
func (s *Store) GetBotInternal(ctx context.Context, botID string) (*Bot, error) {
	query := `
		SELECT id, user_id, name, status, execution_mode, config,
		       level, xp, win_streak, best_streak, unlocked_features,
		       created_at, updated_at, started_at, stopped_at
		FROM trading_bots WHERE id = $1
	`
	var b Bot
	var configJSON, featuresJSON []byte
	err := s.pool.QueryRow(ctx, query, botID).Scan(
		&b.ID, &b.UserID, &b.Name, &b.Status, &b.ExecutionMode, &configJSON,
		&b.Level, &b.XP, &b.WinStreak, &b.BestStreak, &featuresJSON,
		&b.CreatedAt, &b.UpdatedAt, &b.StartedAt, &b.StoppedAt,
	)
	if err != nil {
		return nil, err
	}
	_ = json.Unmarshal(configJSON, &b.Config)
	_ = json.Unmarshal(featuresJSON, &b.UnlockedFeatures)
	return &b, nil
}

// ListBots returns all bots owned by a user.
func (s *Store) ListBots(ctx context.Context, userID string) ([]*Bot, error) {
	query := `
		SELECT id, user_id, name, status, execution_mode, config,
		       level, xp, win_streak, best_streak, unlocked_features,
		       created_at, updated_at, started_at, stopped_at
		FROM trading_bots WHERE user_id = $1 ORDER BY created_at DESC
	`
	rows, err := s.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("query bots: %w", err)
	}
	defer rows.Close()

	var out []*Bot
	for rows.Next() {
		var b Bot
		var configJSON, featuresJSON []byte
		if err := rows.Scan(
			&b.ID, &b.UserID, &b.Name, &b.Status, &b.ExecutionMode, &configJSON,
			&b.Level, &b.XP, &b.WinStreak, &b.BestStreak, &featuresJSON,
			&b.CreatedAt, &b.UpdatedAt, &b.StartedAt, &b.StoppedAt,
		); err != nil {
			return nil, fmt.Errorf("scan bot: %w", err)
		}
		_ = json.Unmarshal(configJSON, &b.Config)
		_ = json.Unmarshal(featuresJSON, &b.UnlockedFeatures)
		out = append(out, &b)
	}
	return out, nil
}

// UpdateBotStatus sets status and started_at / stopped_at timestamps.
func (s *Store) UpdateBotStatus(ctx context.Context, botID, status string) error {
	var query string
	now := time.Now()
	switch status {
	case StatusRunning:
		query = `UPDATE trading_bots SET status=$1, started_at=$2, updated_at=NOW() WHERE id=$3`
		_, err := s.pool.Exec(ctx, query, status, now, botID)
		return err
	case StatusStopped, StatusError:
		query = `UPDATE trading_bots SET status=$1, stopped_at=$2, updated_at=NOW() WHERE id=$3`
		_, err := s.pool.Exec(ctx, query, status, now, botID)
		return err
	default:
		query = `UPDATE trading_bots SET status=$1, updated_at=NOW() WHERE id=$2`
		_, err := s.pool.Exec(ctx, query, status, botID)
		return err
	}
}

// UpdateBotConfig replaces the config JSON for a bot.
func (s *Store) UpdateBotConfig(ctx context.Context, botID, userID string, cfg BotConfig) error {
	b, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx,
		`UPDATE trading_bots SET config=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3`,
		b, botID, userID)
	return err
}

// DeleteBot removes a bot and all cascaded data.
func (s *Store) DeleteBot(ctx context.Context, botID, userID string) error {
	ct, err := s.pool.Exec(ctx, `DELETE FROM trading_bots WHERE id=$1 AND user_id=$2`, botID, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("bot not found")
	}
	return nil
}

// ---------- Trades ----------

// RecordBotTrade inserts a trade and updates aggregated analytics atomically.
func (s *Store) RecordBotTrade(ctx context.Context, trade *BotTrade) error {
	signalsJSON, err := json.Marshal(trade.SignalSources)
	if err != nil {
		return fmt.Errorf("marshal signals: %w", err)
	}
	metadataJSON, err := json.Marshal(trade.Metadata)
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	insertQ := `
		INSERT INTO bot_trades
			(bot_id, symbol, contract_type, side, stake, payout, pnl, entry_price, exit_price,
			 execution_mode, signal_sources, deriv_contract_id, xp_gained, executed_at, closed_at, metadata)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
		RETURNING id
	`
	err = tx.QueryRow(ctx, insertQ,
		trade.BotID, trade.Symbol, trade.ContractType, trade.Side,
		trade.Stake, trade.Payout, trade.PnL, trade.EntryPrice, trade.ExitPrice,
		trade.ExecutionMode, signalsJSON, trade.DerivContractID, trade.XPGained,
		trade.ExecutedAt, trade.ClosedAt, metadataJSON,
	).Scan(&trade.ID)
	if err != nil {
		return fmt.Errorf("insert trade: %w", err)
	}

	// Update analytics inline
	if trade.PnL != nil {
		pnl := *trade.PnL
		isWin := pnl.IsPositive()
		upd := `
			UPDATE bot_analytics
			SET total_trades = total_trades + 1,
			    winning_trades = winning_trades + CASE WHEN $2 THEN 1 ELSE 0 END,
			    losing_trades  = losing_trades  + CASE WHEN $2 THEN 0 ELSE 1 END,
			    total_pnl      = total_pnl + $3,
			    last_trade_at  = $4,
			    updated_at     = NOW()
			WHERE bot_id = $1
		`
		if _, err := tx.Exec(ctx, upd, trade.BotID, isWin, pnl, trade.ExecutedAt); err != nil {
			return fmt.Errorf("update analytics: %w", err)
		}

		// Recompute win_rate, avg_win, avg_loss
		refresh := `
			UPDATE bot_analytics a
			SET win_rate = CASE WHEN a.total_trades > 0
			               THEN (a.winning_trades::decimal / a.total_trades) * 100
			               ELSE 0 END,
			    avg_win  = COALESCE((SELECT AVG(pnl) FROM bot_trades WHERE bot_id=$1 AND pnl > 0), 0),
			    avg_loss = COALESCE((SELECT AVG(pnl) FROM bot_trades WHERE bot_id=$1 AND pnl < 0), 0)
			WHERE a.bot_id=$1
		`
		if _, err := tx.Exec(ctx, refresh, trade.BotID); err != nil {
			return fmt.Errorf("refresh analytics: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// ListBotTrades returns recent trades for a bot (owner-scoped).
func (s *Store) ListBotTrades(ctx context.Context, botID, userID string, limit int) ([]*BotTrade, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	// Verify ownership first
	if _, err := s.GetBot(ctx, botID, userID); err != nil {
		return nil, err
	}

	query := `
		SELECT id, bot_id, symbol, contract_type, side, stake, payout, pnl,
		       entry_price, exit_price, execution_mode, signal_sources, deriv_contract_id,
		       xp_gained, executed_at, closed_at, metadata
		FROM bot_trades WHERE bot_id=$1 ORDER BY executed_at DESC LIMIT $2
	`
	rows, err := s.pool.Query(ctx, query, botID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*BotTrade
	for rows.Next() {
		var t BotTrade
		var signalsJSON, metadataJSON []byte
		if err := rows.Scan(
			&t.ID, &t.BotID, &t.Symbol, &t.ContractType, &t.Side, &t.Stake,
			&t.Payout, &t.PnL, &t.EntryPrice, &t.ExitPrice, &t.ExecutionMode,
			&signalsJSON, &t.DerivContractID, &t.XPGained, &t.ExecutedAt, &t.ClosedAt, &metadataJSON,
		); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(signalsJSON, &t.SignalSources)
		_ = json.Unmarshal(metadataJSON, &t.Metadata)
		out = append(out, &t)
	}
	return out, nil
}

// ---------- Analytics ----------

// GetBotAnalytics returns aggregated performance metrics.
func (s *Store) GetBotAnalytics(ctx context.Context, botID, userID string) (*BotAnalytics, error) {
	if _, err := s.GetBot(ctx, botID, userID); err != nil {
		return nil, err
	}
	return s.getBotAnalyticsInternal(ctx, botID)
}

func (s *Store) getBotAnalyticsInternal(ctx context.Context, botID string) (*BotAnalytics, error) {
	query := `
		SELECT bot_id, total_trades, winning_trades, losing_trades, total_pnl,
		       win_rate, avg_win, avg_loss, max_drawdown, sharpe_ratio, profit_factor,
		       last_trade_at, updated_at
		FROM bot_analytics WHERE bot_id=$1
	`
	var a BotAnalytics
	err := s.pool.QueryRow(ctx, query, botID).Scan(
		&a.BotID, &a.TotalTrades, &a.WinningTrades, &a.LosingTrades, &a.TotalPnL,
		&a.WinRate, &a.AvgWin, &a.AvgLoss, &a.MaxDrawdown, &a.SharpeRatio, &a.ProfitFactor,
		&a.LastTradeAt, &a.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return &BotAnalytics{BotID: botID, TotalPnL: decimal.Zero}, nil
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

// ---------- Signals ----------

// RecordSignalLog inserts a signal log entry.
func (s *Store) RecordSignalLog(ctx context.Context, log *BotSignalLog) error {
	data, err := json.Marshal(log.SignalData)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO bot_signals_log (bot_id, signal_type, signal_data, action_taken, confidence)
		VALUES ($1,$2,$3,$4,$5)
	`, log.BotID, log.SignalType, data, log.ActionTaken, log.Confidence)
	return err
}

// ListSignalLogs returns recent signal logs.
func (s *Store) ListSignalLogs(ctx context.Context, botID, userID string, limit int) ([]*BotSignalLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	if _, err := s.GetBot(ctx, botID, userID); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx,
		`SELECT id, bot_id, signal_type, signal_data, action_taken, confidence, created_at
		 FROM bot_signals_log WHERE bot_id=$1 ORDER BY created_at DESC LIMIT $2`,
		botID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []*BotSignalLog
	for rows.Next() {
		var l BotSignalLog
		var data []byte
		if err := rows.Scan(&l.ID, &l.BotID, &l.SignalType, &data, &l.ActionTaken, &l.Confidence, &l.CreatedAt); err != nil {
			return nil, err
		}
		_ = json.Unmarshal(data, &l.SignalData)
		out = append(out, &l)
	}
	return out, nil
}

// ---------- Level / XP ----------

// UpdateBotLevelAndXP persists new level + XP + streak state.
func (s *Store) UpdateBotLevelAndXP(ctx context.Context, botID string, level, xp, winStreak, bestStreak int, features []string) error {
	fJSON, err := json.Marshal(features)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `
		UPDATE trading_bots
		SET level=$1, xp=$2, win_streak=$3, best_streak=$4, unlocked_features=$5, updated_at=NOW()
		WHERE id=$6
	`, level, xp, winStreak, bestStreak, fJSON, botID)
	return err
}
