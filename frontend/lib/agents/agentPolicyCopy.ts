'use strict';

import type {
  AssetLove,
  DecisionStyle,
  MarketSense,
  MoneyApproach,
  PersonalityArchetype,
  ProfitDream,
  ProtectionMindset,
  TimePatience,
  TradingInstinct,
} from './agentPolicy';

/** Deriv synthetic underlyings shown in Command Center + paper policy. */
export const DERIV_SYNTHETIC_SYMBOLS = [
  '1HZ100V',
  '1HZ75V',
  '1HZ50V',
  'R_10',
  'R_25',
  'R_50',
  'R_75',
  'R_100',
] as const;

/** Common Deriv API symbol names (ticks via same public WS). Availability depends on account / offering. */
export const DERIV_MARKET_PRESET_GROUPS: readonly {
  label: string;
  symbols: readonly string[];
}[] = [
  {
    label: 'Forex-style (frx*)',
    symbols: ['frxEURUSD', 'frxGBPUSD', 'frxUSDJPY', 'frxAUDUSD'],
  },
  {
    label: 'Crypto-style (cry*)',
    symbols: ['cryBTCUSD', 'cryETHUSD', 'cryLTCUSD'],
  },
  {
    label: 'Commodities / metals (examples)',
    symbols: ['frxXAUUSD', 'frxXAGUSD'],
  },
] as const;

export type AgentPolicyWizardStepId = 1 | 2 | 3 | 4 | 5;

export const AGENT_POLICY_WIZARD_STEPS: readonly {
  id: AgentPolicyWizardStepId;
  title: string;
  sub: string;
}[] = [
  { id: 1, title: 'Basic identity', sub: 'Who your agent is' },
  { id: 2, title: 'Trading style', sub: 'How it hunts' },
  { id: 3, title: 'Risk & money', sub: 'Sizing and safety' },
  { id: 4, title: 'Preferences', sub: 'Markets and signal mix' },
  { id: 5, title: 'Launch', sub: 'Review and save' },
] as const;

export const AGENT_POLICY_UI = {
  wizardTitle: 'Agent policy',
  randomize: 'Skip (randomize)',
  back: 'Back',
  continue: 'Continue →',
  savePolicy: 'Save policy',
  /** Shown above persona sections in Command Center / Arena sidebar */
  arenaPersonaIntro:
    'Persona, sizing style, and Deriv symbol drive local swarm weights and the center Paper swarm runner. Saved with Deploy Agent to this browser.',
  marketBlurb:
    'Pick a Deriv synthetic underlying (API symbol). This drives Command Center ticks and the Paper swarm symbol — not a separate spot forex/crypto/commodities product.',
  marketFamiliesBlurb:
    'Volatility family: 1HZ100V, 1HZ75V, 1HZ50V. Jump family: R_10 … R_100. Deriv does not expose classic “EURUSD vs BTC vs gold” pickers here; those are represented as synthetic index contracts.',
} as const;

export const AGENT_POLICY_LABELS = {
  designation: 'Designation / name',
  avatarSlot: 'Avatar slot',
  personality: 'Personality',
  decisionStyle: 'Decision style',
  tradingInstinct: 'Trading instinct',
  timePatience: 'Time patience (paper bars)',
  profitDream: 'Profit dream',
  moneyApproach: 'Money approach',
  protectionMindset: 'Protection mindset',
  paperStartingCash: 'Paper starting cash (reset ledger to apply)',
  signalMix: 'Signal mix (Deriv data)',
  syntheticFamily: 'Synthetic family (Deriv API symbols)',
  primarySymbol: 'Primary symbol (Deriv underlying)',
  strategyNotes: 'Strategy notes',
  paperTradingAck:
    'I understand this is simulated trading; live Deriv trading requires separate auth and risk controls.',
} as const;

export const PERSONALITY_CHOICES: readonly {
  value: PersonalityArchetype;
  label: string;
  desc: string;
}[] = [
  {
    value: 'careful_guardian',
    label: 'Careful guardian',
    desc: 'Capital preservation, strict downside limits.',
  },
  {
    value: 'balanced_trader',
    label: 'Balanced trader',
    desc: 'Moderate risk / reward.',
  },
  {
    value: 'bold_adventurer',
    label: 'Bold adventurer',
    desc: 'Higher volatility tolerance.',
  },
];

export const DECISION_STYLE_CHOICES: readonly {
  value: DecisionStyle;
  label: string;
  desc: string;
}[] = [
  {
    value: 'gut_instinct',
    label: 'Gut instinct',
    desc: 'Fast; momentum and sentiment weighted.',
  },
  {
    value: 'deep_analyst',
    label: 'Deep analyst',
    desc: 'Data-heavy; longer lookback.',
  },
  {
    value: 'patient_observer',
    label: 'Patient observer',
    desc: 'Fewer trades; higher conviction bar.',
  },
];

export const TRADING_INSTINCT_CHOICES: readonly {
  value: TradingInstinct;
  label: string;
  desc: string;
}[] = [
  { value: 'trend_chaser', label: 'Trend chaser', desc: 'Follow momentum.' },
  { value: 'value_hunter', label: 'Value hunter', desc: 'Fade extremes; mean reversion tilt.' },
  {
    value: 'reversal_spotter',
    label: 'Reversal spotter',
    desc: 'Counter-trend at exhaustion hints.',
  },
  { value: 'speed_demon', label: 'Speed demon', desc: 'Short horizon; higher momentum weight.' },
];

export const TIME_PATIENCE_CHOICES: readonly {
  value: TimePatience;
  label: string;
  desc: string;
}[] = [
  { value: 'lightning_day', label: 'Lightning day', desc: 'Tight max holding window.' },
  { value: 'swing_rider', label: 'Swing rider', desc: 'Default swing-style holds.' },
  {
    value: 'long_term_visionary',
    label: 'Long-term visionary',
    desc: 'Longer holds before time exit.',
  },
];

export const PROFIT_DREAM_CHOICES: readonly {
  value: ProfitDream;
  label: string;
  desc: string;
}[] = [
  { value: 'quick_wins', label: 'Quick wins', desc: 'Smaller size, steadier clips.' },
  { value: 'big_moves', label: 'Big moves', desc: 'Larger caps when conviction is high.' },
  { value: 'wealth_builder', label: 'Wealth builder', desc: 'Balanced compounding path.' },
];

export const MONEY_APPROACH_CHOICES: readonly {
  value: MoneyApproach;
  label: string;
  desc: string;
}[] = [
  { value: 'fixed_safe', label: 'Fixed & safe', desc: 'Stable stake from bankroll %.' },
  {
    value: 'smart_scaling',
    label: 'Smart scaling',
    desc: 'Stake scales with streak + confidence.',
  },
  {
    value: 'aggressive_sizer',
    label: 'Aggressive sizer',
    desc: 'Larger utilization when confident.',
  },
];

export const PROTECTION_CHOICES: readonly {
  value: ProtectionMindset;
  label: string;
  desc: string;
}[] = [
  {
    value: 'tight_guardian',
    label: 'Tight guardian',
    desc: 'Stricter confidence; shorter max hold.',
  },
  { value: 'flexible', label: 'Flexible', desc: 'Balanced exits vs flips.' },
  {
    value: 'hands_off',
    label: 'Hands-off',
    desc: 'Looser guard; favors letting legs run.',
  },
];

export const MARKET_SENSE_CHOICES: readonly {
  value: MarketSense;
  label: string;
  desc: string;
}[] = [
  {
    value: 'fixed_rules',
    label: 'Tickstructure only',
    desc: 'Weights ticks, probability, regime; sentiment channel off.',
  },
  {
    value: 'mood_reader',
    label: 'Narrative tilt',
    desc: 'Adds soft sentiment from your strategy notes (optional overlay).',
  },
];

export const ASSET_LOVE_CHOICES: readonly {
  value: AssetLove;
  label: string;
  desc: string;
}[] = [
  {
    value: 'stocks_fan',
    label: 'Volatility 1s (1HZ*)',
    desc: 'One-second volatility indices — default 1HZ100V.',
  },
  {
    value: 'forex_pro',
    label: 'Countdown ranges (R_*)',
    desc: 'Range-style synthetics — default R_75.',
  },
  {
    value: 'crypto_rebel',
    label: 'Faster-tick vol',
    desc: 'Higher tick cadence vol index — default 1HZ50V.',
  },
  {
    value: 'all_rounder',
    label: 'Mixed synthetics',
    desc: 'Blended 1HZ + R_* profile — default 1HZ75V.',
  },
];
