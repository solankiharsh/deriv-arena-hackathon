package tradingbot

import (
	"context"

	"go.uber.org/zap"
)

// LevelingEngine handles XP math and level-up detection.
type LevelingEngine struct {
	store  *Store
	logger *zap.Logger
}

// NewLevelingEngine returns a leveling engine.
func NewLevelingEngine(store *Store, logger *zap.Logger) *LevelingEngine {
	if logger == nil {
		logger = zap.NewNop()
	}
	return &LevelingEngine{store: store, logger: logger}
}

// levelThresholds[i] is the min XP required to reach level i+1.
var levelThresholds = []int{0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500}

var featureMap = map[int][]string{
	1:  {"rsi"},
	3:  {"macd", "bollinger"},
	4:  {"ai_patterns"},
	5:  {"news_sentiment"},
	6:  {"multi_market"},
	7:  {"exotic_contracts"},
	8:  {"advanced_risk"},
	9:  {"custom_weights"},
	10: {"bot_cloning", "strategy_sharing"},
}

// CalculateXPForTrade awards XP based on trade outcome, streaks, and signal complexity.
// Returns (xpGain, newWinStreak, newBestStreak).
func (le *LevelingEngine) CalculateXPForTrade(trade *BotTrade, bot *Bot) (int, int, int) {
	baseXP := 10
	winStreak := bot.WinStreak
	bestStreak := bot.BestStreak

	isWin := trade.PnL != nil && trade.PnL.IsPositive()
	isLoss := trade.PnL != nil && trade.PnL.IsNegative()

	if isWin {
		baseXP += 15
		winStreak++
		if winStreak > bestStreak {
			bestStreak = winStreak
		}
	} else if isLoss {
		baseXP -= 5
		if baseXP < 0 {
			baseXP = 0
		}
		winStreak = 0
	}

	// Streak multipliers (applied after base)
	switch {
	case winStreak >= 10:
		baseXP = int(float64(baseXP) * 3.0)
	case winStreak >= 5:
		baseXP = int(float64(baseXP) * 2.0)
	case winStreak >= 3:
		baseXP = int(float64(baseXP) * 1.5)
	}

	// Signal complexity bonus
	signalCount := 0
	if trade.SignalSources != nil {
		if _, ok := trade.SignalSources["technical"]; ok {
			signalCount++
		}
		if _, ok := trade.SignalSources["news"]; ok {
			signalCount++
		}
		if _, ok := trade.SignalSources["ai_pattern"]; ok {
			signalCount++
		}
		if signalCount == 3 {
			baseXP += 10
		}
		// High confidence bonus
		if c, ok := trade.SignalSources["confidence"].(float64); ok && c > 0.9 {
			baseXP += 5
		}
	}

	return baseXP, winStreak, bestStreak
}

// GetLevelForXP returns the level (1-10) for the given cumulative XP.
func (le *LevelingEngine) GetLevelForXP(xp int) int {
	for i := len(levelThresholds) - 1; i >= 0; i-- {
		if xp >= levelThresholds[i] {
			return i + 1
		}
	}
	return 1
}

// GetUnlockedFeatures returns all features unlocked by a given level.
func (le *LevelingEngine) GetUnlockedFeatures(level int) []string {
	var unlocked []string
	for lvl := 1; lvl <= level; lvl++ {
		if feats, ok := featureMap[lvl]; ok {
			unlocked = append(unlocked, feats...)
		}
	}
	if unlocked == nil {
		return []string{}
	}
	return unlocked
}

// GetXPForLevel returns the minimum XP needed for a level.
func GetXPForLevel(level int) int {
	if level <= 0 {
		return 0
	}
	if level > len(levelThresholds) {
		return levelThresholds[len(levelThresholds)-1]
	}
	return levelThresholds[level-1]
}

// AwardXPAndCheckLevelUp updates bot XP, persists new state, and returns LevelUpResult on level-up.
func (le *LevelingEngine) AwardXPAndCheckLevelUp(
	ctx context.Context,
	bot *Bot,
	xpGain, newWinStreak, newBestStreak int,
) (*LevelUpResult, error) {
	oldLevel := bot.Level
	newXP := bot.XP + xpGain
	newLevel := le.GetLevelForXP(newXP)
	features := le.GetUnlockedFeatures(newLevel)

	if err := le.store.UpdateBotLevelAndXP(ctx, bot.ID, newLevel, newXP, newWinStreak, newBestStreak, features); err != nil {
		return nil, err
	}

	// Mutate bot to reflect new values for the caller
	bot.Level = newLevel
	bot.XP = newXP
	bot.WinStreak = newWinStreak
	bot.BestStreak = newBestStreak
	bot.UnlockedFeatures = features

	if newLevel > oldLevel {
		newlyUnlocked := []string{}
		for lvl := oldLevel + 1; lvl <= newLevel; lvl++ {
			if feats, ok := featureMap[lvl]; ok {
				newlyUnlocked = append(newlyUnlocked, feats...)
			}
		}
		return &LevelUpResult{
			BotID:            bot.ID,
			OldLevel:         oldLevel,
			NewLevel:         newLevel,
			XP:               newXP,
			UnlockedFeatures: newlyUnlocked,
		}, nil
	}
	return nil, nil
}
