package tradingbot

import (
	"fmt"
	"strings"
)

// BotAgentPolicy mirrors the paper-agent wizard taxonomy (optional layer on BotConfig).
type BotAgentPolicy struct {
	Identity       AgentPolicyIdentity       `json:"identity"`
	TradingStyle   AgentPolicyTradingStyle   `json:"tradingStyle"`
	Risk           AgentPolicyRisk           `json:"risk"`
	Preferences    AgentPolicyPreferences    `json:"preferences"`
	Deployment     AgentPolicyDeployment     `json:"deployment"`
}

type AgentPolicyIdentity struct {
	DisplayName     string `json:"displayName"`
	Personality     string `json:"personality"`
	DecisionStyle   string `json:"decisionStyle"`
}

type AgentPolicyTradingStyle struct {
	Instinct    string `json:"instinct"`
	Patience    string `json:"patience"`
	ProfitDream string `json:"profitDream"`
}

type AgentPolicyRisk struct {
	MoneyApproach string `json:"moneyApproach"`
	Protection    string `json:"protection"`
}

type AgentPolicyPreferences struct {
	MarketSense   string `json:"marketSense"`
	AssetLove     string `json:"assetLove"`
	PrimarySymbol string `json:"primarySymbol"`
	StrategyNotes string `json:"strategyNotes"`
}

type AgentPolicyDeployment struct {
	PaperStartingCash       int  `json:"paperStartingCash"`
	DeploymentAcknowledged  bool `json:"deploymentAcknowledged"`
}

// PolicyTuning is derived from BotAgentPolicy for the signal processor and stake sizing.
type PolicyTuning struct {
	ThresholdDelta float64 // added to base risk-profile threshold
	NewsMult       float64 // multiplied with cfg.Indicators.NewsWeight
	StakeMult      float64 // multiplied with base stake
}

func normalizeAgentPolicy(p *BotAgentPolicy) {
	if p == nil {
		return
	}
	p.Identity.DisplayName = strings.TrimSpace(p.Identity.DisplayName)
	if len(p.Identity.DisplayName) > 64 {
		p.Identity.DisplayName = p.Identity.DisplayName[:64]
	}
	if p.Preferences.PrimarySymbol != "" {
		var b strings.Builder
		for _, r := range p.Preferences.PrimarySymbol {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
				b.WriteRune(r)
			}
			if b.Len() >= 32 {
				break
			}
		}
		p.Preferences.PrimarySymbol = b.String()
	}
	if len(p.Preferences.StrategyNotes) > 500 {
		p.Preferences.StrategyNotes = p.Preferences.StrategyNotes[:500]
	}
	if p.Deployment.PaperStartingCash < 100 {
		p.Deployment.PaperStartingCash = 100
	}
	if p.Deployment.PaperStartingCash > 1_000_000 {
		p.Deployment.PaperStartingCash = 1_000_000
	}
}

func validateAgentPolicy(p *BotAgentPolicy) error {
	if p == nil {
		return nil
	}
	normalizeAgentPolicy(p)

	okPersonality := map[string]bool{
		"careful_guardian": true, "balanced_trader": true, "bold_adventurer": true, "": true,
	}
	if !okPersonality[p.Identity.Personality] {
		return fmt.Errorf("invalid agentPolicy.identity.personality")
	}
	okDecision := map[string]bool{
		"gut_instinct": true, "deep_analyst": true, "patient_observer": true, "": true,
	}
	if !okDecision[p.Identity.DecisionStyle] {
		return fmt.Errorf("invalid agentPolicy.identity.decisionStyle")
	}
	okInstinct := map[string]bool{
		"trend_chaser": true, "value_hunter": true, "reversal_spotter": true, "speed_demon": true, "": true,
	}
	if !okInstinct[p.TradingStyle.Instinct] {
		return fmt.Errorf("invalid agentPolicy.tradingStyle.instinct")
	}
	okPatience := map[string]bool{
		"lightning_day": true, "swing_rider": true, "long_term_visionary": true, "": true,
	}
	if !okPatience[p.TradingStyle.Patience] {
		return fmt.Errorf("invalid agentPolicy.tradingStyle.patience")
	}
	okDream := map[string]bool{
		"quick_wins": true, "big_moves": true, "wealth_builder": true, "": true,
	}
	if !okDream[p.TradingStyle.ProfitDream] {
		return fmt.Errorf("invalid agentPolicy.tradingStyle.profitDream")
	}
	okMoney := map[string]bool{
		"fixed_safe": true, "smart_scaling": true, "aggressive_sizer": true, "": true,
	}
	if !okMoney[p.Risk.MoneyApproach] {
		return fmt.Errorf("invalid agentPolicy.risk.moneyApproach")
	}
	okProt := map[string]bool{
		"tight_guardian": true, "flexible": true, "hands_off": true, "": true,
	}
	if !okProt[p.Risk.Protection] {
		return fmt.Errorf("invalid agentPolicy.risk.protection")
	}
	okSense := map[string]bool{
		"fixed_rules": true, "mood_reader": true, "": true,
	}
	if !okSense[p.Preferences.MarketSense] {
		return fmt.Errorf("invalid agentPolicy.preferences.marketSense")
	}
	okAsset := map[string]bool{
		"stocks_fan": true, "forex_pro": true, "crypto_rebel": true, "all_rounder": true, "": true,
	}
	if !okAsset[p.Preferences.AssetLove] {
		return fmt.Errorf("invalid agentPolicy.preferences.assetLove")
	}
	return nil
}

// TuningFromAgentPolicy computes modifiers; if p is nil, returns neutral tuning.
func TuningFromAgentPolicy(p *BotAgentPolicy) PolicyTuning {
	t := PolicyTuning{NewsMult: 1, StakeMult: 1}
	if p == nil {
		return t
	}
	switch p.Identity.Personality {
	case "careful_guardian":
		t.ThresholdDelta += 0.10
	case "bold_adventurer":
		t.ThresholdDelta -= 0.08
	}
	switch p.Identity.DecisionStyle {
	case "gut_instinct":
		t.ThresholdDelta -= 0.03
	case "deep_analyst":
		t.ThresholdDelta += 0.05
	case "patient_observer":
		t.ThresholdDelta += 0.08
	}
	switch p.Risk.Protection {
	case "tight_guardian":
		t.ThresholdDelta += 0.06
	case "hands_off":
		t.ThresholdDelta -= 0.05
	}
	switch p.Preferences.MarketSense {
	case "fixed_rules":
		t.NewsMult *= 0.85
	case "mood_reader":
		t.NewsMult *= 1.2
	}
	switch p.Risk.MoneyApproach {
	case "fixed_safe":
		t.StakeMult *= 0.9
	case "aggressive_sizer":
		t.StakeMult *= 1.15
	}
	switch p.TradingStyle.ProfitDream {
	case "quick_wins":
		t.StakeMult *= 0.9
	case "big_moves":
		t.StakeMult *= 1.1
	}
	// Clamp stake multiplier
	if t.StakeMult < 0.5 {
		t.StakeMult = 0.5
	}
	if t.StakeMult > 1.5 {
		t.StakeMult = 1.5
	}
	if t.NewsMult < 0.5 {
		t.NewsMult = 0.5
	}
	if t.NewsMult > 1.5 {
		t.NewsMult = 1.5
	}
	return t
}
