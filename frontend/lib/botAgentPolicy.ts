'use strict';

/** Canonical enums aligned with paper-agent / backend `BotAgentPolicy`. */

export type PersonalityArchetype = 'careful_guardian' | 'balanced_trader' | 'bold_adventurer';
export type DecisionStyle = 'gut_instinct' | 'deep_analyst' | 'patient_observer';
export type TradingInstinct = 'trend_chaser' | 'value_hunter' | 'reversal_spotter' | 'speed_demon';
export type TimePatience = 'lightning_day' | 'swing_rider' | 'long_term_visionary';
export type ProfitDream = 'quick_wins' | 'big_moves' | 'wealth_builder';
export type MoneyApproach = 'fixed_safe' | 'smart_scaling' | 'aggressive_sizer';
export type ProtectionMindset = 'tight_guardian' | 'flexible' | 'hands_off';
export type MarketSense = 'fixed_rules' | 'mood_reader';
export type AssetLove = 'stocks_fan' | 'forex_pro' | 'crypto_rebel' | 'all_rounder';

export interface BotAgentPolicyIdentity {
  displayName: string;
  personality: PersonalityArchetype;
  decisionStyle: DecisionStyle;
}

export interface BotAgentPolicyTradingStyle {
  instinct: TradingInstinct;
  patience: TimePatience;
  profitDream: ProfitDream;
}

export interface BotAgentPolicyRisk {
  moneyApproach: MoneyApproach;
  protection: ProtectionMindset;
}

export interface BotAgentPolicyPreferences {
  marketSense: MarketSense;
  assetLove: AssetLove;
  primarySymbol: string;
  strategyNotes: string;
}

export interface BotAgentPolicyDeployment {
  paperStartingCash: number;
  deploymentAcknowledged: boolean;
}

export interface BotAgentPolicy {
  identity: BotAgentPolicyIdentity;
  tradingStyle: BotAgentPolicyTradingStyle;
  risk: BotAgentPolicyRisk;
  preferences: BotAgentPolicyPreferences;
  deployment: BotAgentPolicyDeployment;
}

export function defaultBotAgentPolicy(): BotAgentPolicy {
  return {
    identity: {
      displayName: '',
      personality: 'balanced_trader',
      decisionStyle: 'deep_analyst',
    },
    tradingStyle: {
      instinct: 'trend_chaser',
      patience: 'swing_rider',
      profitDream: 'wealth_builder',
    },
    risk: {
      moneyApproach: 'smart_scaling',
      protection: 'flexible',
    },
    preferences: {
      marketSense: 'fixed_rules',
      assetLove: 'all_rounder',
      primarySymbol: '',
      strategyNotes: '',
    },
    deployment: {
      paperStartingCash: 10000,
      deploymentAcknowledged: false,
    },
  };
}

export type AutoStopMode = 'first_hit' | 'target_only' | 'risk_only';
