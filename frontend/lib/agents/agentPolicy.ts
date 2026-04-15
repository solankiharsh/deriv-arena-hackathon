'use strict';

export const AGENT_POLICY_VERSION = 1 as const;

/** Step 1 — personality risk posture */
export type PersonalityArchetype = 'careful_guardian' | 'balanced_trader' | 'bold_adventurer';

/** Step 1 — how decisions are framed */
export type DecisionStyle = 'gut_instinct' | 'deep_analyst' | 'patient_observer';

/** Step 2 — core hunt style */
export type TradingInstinct = 'trend_chaser' | 'value_hunter' | 'reversal_spotter' | 'speed_demon';

/** Step 2 — holding horizon (paper bars / live timeframe proxy) */
export type TimePatience = 'lightning_day' | 'swing_rider' | 'long_term_visionary';

/** Step 2 — profit objective */
export type ProfitDream = 'quick_wins' | 'big_moves' | 'wealth_builder';

/** Step 3 — position sizing philosophy */
export type MoneyApproach = 'fixed_safe' | 'smart_scaling' | 'aggressive_sizer';

/** Step 3 — exit / stop strictness */
export type ProtectionMindset = 'tight_guardian' | 'flexible' | 'hands_off';

/** Step 4 — signal source bias */
export type MarketSense = 'fixed_rules' | 'mood_reader';

/** Step 4 — asset class focus (Deriv symbols mapped elsewhere) */
export type AssetLove = 'stocks_fan' | 'forex_pro' | 'crypto_rebel' | 'all_rounder';

export interface AgentPolicyIdentity {
  displayName: string;
  /** 0–4 preset avatar slot */
  avatarId: number;
  personality: PersonalityArchetype;
  decisionStyle: DecisionStyle;
}

export interface AgentPolicyTradingStyle {
  instinct: TradingInstinct;
  patience: TimePatience;
  profitDream: ProfitDream;
}

export interface AgentPolicyRisk {
  moneyApproach: MoneyApproach;
  protection: ProtectionMindset;
}

export interface AgentPolicyPreferences {
  marketSense: MarketSense;
  assetLove: AssetLove;
  /** Primary Deriv underlying symbol */
  primarySymbol: string;
  strategyNotes: string;
}

export interface AgentPolicy {
  version: typeof AGENT_POLICY_VERSION;
  identity: AgentPolicyIdentity;
  tradingStyle: AgentPolicyTradingStyle;
  risk: AgentPolicyRisk;
  preferences: AgentPolicyPreferences;
  deployment: {
    mode: 'paper' | 'demo' | 'live';
    paperStartingCash: number;
    deploymentAcknowledged: boolean;
  };
}

export const DEFAULT_AGENT_POLICY: AgentPolicy = {
  version: AGENT_POLICY_VERSION,
  identity: {
    displayName: 'Operator',
    avatarId: 0,
    personality: 'balanced_trader',
    decisionStyle: 'deep_analyst',
  },
  tradingStyle: {
    instinct: 'reversal_spotter',
    patience: 'swing_rider',
    profitDream: 'wealth_builder',
  },
  risk: {
    moneyApproach: 'smart_scaling',
    protection: 'flexible',
  },
  preferences: {
    marketSense: 'fixed_rules',
    assetLove: 'crypto_rebel',
    primarySymbol: '1HZ100V',
    strategyNotes: '',
  },
  deployment: {
    mode: 'paper',
    paperStartingCash: 10_000,
    deploymentAcknowledged: false,
  },
};

const PERSONALITIES: PersonalityArchetype[] = ['careful_guardian', 'balanced_trader', 'bold_adventurer'];
const DECISIONS: DecisionStyle[] = ['gut_instinct', 'deep_analyst', 'patient_observer'];
const INSTINCTS: TradingInstinct[] = ['trend_chaser', 'value_hunter', 'reversal_spotter', 'speed_demon'];
const PATIENCES: TimePatience[] = ['lightning_day', 'swing_rider', 'long_term_visionary'];
const DREAMS: ProfitDream[] = ['quick_wins', 'big_moves', 'wealth_builder'];
const MONEY: MoneyApproach[] = ['fixed_safe', 'smart_scaling', 'aggressive_sizer'];
const PROTECTIONS: ProtectionMindset[] = ['tight_guardian', 'flexible', 'hands_off'];
const SENSES: MarketSense[] = ['fixed_rules', 'mood_reader'];
const ASSETS: AssetLove[] = ['stocks_fan', 'forex_pro', 'crypto_rebel', 'all_rounder'];
const MODES = ['paper', 'demo', 'live'] as const;

function clampInt(n: unknown, lo: number, hi: number, fallback: number): number {
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(hi, Math.max(lo, Math.floor(x)));
}

function clampStr(s: unknown, max: number): string {
  const t = typeof s === 'string' ? s : String(s ?? '');
  return t.length <= max ? t : t.slice(0, max);
}

export function parseAgentPolicy(raw: unknown): AgentPolicy {
  const d = DEFAULT_AGENT_POLICY;
  if (!raw || typeof raw !== 'object') return { ...d };

  const o = raw as Record<string, unknown>;
  const version = o.version === AGENT_POLICY_VERSION ? AGENT_POLICY_VERSION : AGENT_POLICY_VERSION;

  const id = (o.identity && typeof o.identity === 'object' ? o.identity : {}) as Record<string, unknown>;
  const ts = (o.tradingStyle && typeof o.tradingStyle === 'object' ? o.tradingStyle : {}) as Record<string, unknown>;
  const rk = (o.risk && typeof o.risk === 'object' ? o.risk : {}) as Record<string, unknown>;
  const pref = (o.preferences && typeof o.preferences === 'object' ? o.preferences : {}) as Record<string, unknown>;
  const dep = (o.deployment && typeof o.deployment === 'object' ? o.deployment : {}) as Record<string, unknown>;

  const personality = PERSONALITIES.includes(id.personality as PersonalityArchetype)
    ? (id.personality as PersonalityArchetype)
    : d.identity.personality;
  const decisionStyle = DECISIONS.includes(id.decisionStyle as DecisionStyle)
    ? (id.decisionStyle as DecisionStyle)
    : d.identity.decisionStyle;

  const instinct = INSTINCTS.includes(ts.instinct as TradingInstinct)
    ? (ts.instinct as TradingInstinct)
    : d.tradingStyle.instinct;
  const patience = PATIENCES.includes(ts.patience as TimePatience)
    ? (ts.patience as TimePatience)
    : d.tradingStyle.patience;
  const profitDream = DREAMS.includes(ts.profitDream as ProfitDream)
    ? (ts.profitDream as ProfitDream)
    : d.tradingStyle.profitDream;

  const moneyApproach = MONEY.includes(rk.moneyApproach as MoneyApproach)
    ? (rk.moneyApproach as MoneyApproach)
    : d.risk.moneyApproach;
  const protection = PROTECTIONS.includes(rk.protection as ProtectionMindset)
    ? (rk.protection as ProtectionMindset)
    : d.risk.protection;

  const marketSense = SENSES.includes(pref.marketSense as MarketSense)
    ? (pref.marketSense as MarketSense)
    : d.preferences.marketSense;
  const assetLove = ASSETS.includes(pref.assetLove as AssetLove)
    ? (pref.assetLove as AssetLove)
    : d.preferences.assetLove;

  const primarySymbol = /^[A-Za-z0-9_]+$/.test(String(pref.primarySymbol ?? ''))
    ? clampStr(pref.primarySymbol, 32).replace(/[^\w]/g, '')
    : d.preferences.primarySymbol;

  const mode = MODES.includes(dep.mode as 'paper' | 'demo' | 'live')
    ? (dep.mode as 'paper' | 'demo' | 'live')
    : d.deployment.mode;

  return {
    version,
    identity: {
      displayName: clampStr(id.displayName ?? d.identity.displayName, 64) || d.identity.displayName,
      avatarId: clampInt(id.avatarId, 0, 4, d.identity.avatarId),
      personality,
      decisionStyle,
    },
    tradingStyle: {
      instinct,
      patience,
      profitDream,
    },
    risk: {
      moneyApproach,
      protection,
    },
    preferences: {
      marketSense,
      assetLove,
      primarySymbol: primarySymbol || d.preferences.primarySymbol,
      strategyNotes: clampStr(pref.strategyNotes ?? '', 500),
    },
    deployment: {
      mode,
      paperStartingCash: Math.max(100, Math.min(1_000_000, clampInt(dep.paperStartingCash, 100, 1_000_000, d.deployment.paperStartingCash))),
      deploymentAcknowledged: Boolean(dep.deploymentAcknowledged),
    },
  };
}

export function randomAgentPolicy(): AgentPolicy {
  const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
  return parseAgentPolicy({
    ...DEFAULT_AGENT_POLICY,
    identity: {
      displayName: `Agent-${Math.floor(Math.random() * 9000) + 1000}`,
      avatarId: Math.floor(Math.random() * 5),
      personality: pick(PERSONALITIES),
      decisionStyle: pick(DECISIONS),
    },
    tradingStyle: {
      instinct: pick(INSTINCTS),
      patience: pick(PATIENCES),
      profitDream: pick(DREAMS),
    },
    risk: {
      moneyApproach: pick(MONEY),
      protection: pick(PROTECTIONS),
    },
    preferences: {
      marketSense: pick(SENSES),
      assetLove: pick(ASSETS),
      primarySymbol: DEFAULT_AGENT_POLICY.preferences.primarySymbol,
      strategyNotes: '',
    },
  });
}
