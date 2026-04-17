'use client';

import { useState } from 'react';
import { defaultBotConfig, BotConfig } from '@/lib/api/trading-bots';
import {
  defaultBotAgentPolicy,
  type AutoStopMode,
  type BotAgentPolicy,
  type PersonalityArchetype,
  type DecisionStyle,
  type TradingInstinct,
  type TimePatience,
  type ProfitDream,
  type MoneyApproach,
  type ProtectionMindset,
  type MarketSense,
  type AssetLove,
} from '@/lib/botAgentPolicy';

const GOLD = '#E8B45E';

/** Canonical Deriv-style asset tickers (mirrors backend allowlist). */
const ASSET_TICKER_OPTIONS = [
  'R_10',
  'R_25',
  'R_50',
  'R_75',
  'R_100',
  'frxEURUSD',
  'frxGBPUSD',
  'frxUSDJPY',
  'cryBTCUSD',
  'cryETHUSD',
] as const;

const MARKET_OPTIONS = ['VOL100-USD', 'VOL75-USD', 'VOL50-USD', 'VOL25-USD'] as const;

const BOT_NAME_ADJECTIVES = [
  'Swift',
  'Nova',
  'Quantum',
  'Apex',
  'Velvet',
  'Iron',
  'Neon',
  'Solar',
] as const;

function randomUint32(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 0;
}

function randomInt(n: number): number {
  if (n <= 0) return 0;
  return randomUint32() % n;
}

function pickOne<T>(arr: readonly T[]): T {
  return arr[randomInt(arr.length)] as T;
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}

function pickNonEmptySubset<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  shuffleInPlace(copy);
  const k = 1 + randomInt(arr.length);
  return copy.slice(0, k);
}

function randomBotName(): string {
  return `Bot-${pickOne(BOT_NAME_ADJECTIVES)}-${1000 + randomInt(9000)}`;
}

function randomAgentPolicy(): BotAgentPolicy {
  const personalities: PersonalityArchetype[] = ['careful_guardian', 'balanced_trader', 'bold_adventurer'];
  const decisionStyles: DecisionStyle[] = ['gut_instinct', 'deep_analyst', 'patient_observer'];
  const instincts: TradingInstinct[] = ['trend_chaser', 'value_hunter', 'reversal_spotter', 'speed_demon'];
  const patience: TimePatience[] = ['lightning_day', 'swing_rider', 'long_term_visionary'];
  const profitDreams: ProfitDream[] = ['quick_wins', 'big_moves', 'wealth_builder'];
  const money: MoneyApproach[] = ['fixed_safe', 'smart_scaling', 'aggressive_sizer'];
  const protection: ProtectionMindset[] = ['tight_guardian', 'flexible', 'hands_off'];
  const marketSense: MarketSense[] = ['fixed_rules', 'mood_reader'];
  const assetLove: AssetLove[] = ['stocks_fan', 'forex_pro', 'crypto_rebel', 'all_rounder'];

  const notesPool = ['Scout mode', 'News-aware', 'Tight session', 'Wide hunt', ''];
  const symPool = ['', ...ASSET_TICKER_OPTIONS, ...MARKET_OPTIONS];

  return {
    identity: {
      displayName: '',
      personality: pickOne(personalities),
      decisionStyle: pickOne(decisionStyles),
    },
    tradingStyle: {
      instinct: pickOne(instincts),
      patience: pickOne(patience),
      profitDream: pickOne(profitDreams),
    },
    risk: {
      moneyApproach: pickOne(money),
      protection: pickOne(protection),
    },
    preferences: {
      marketSense: pickOne(marketSense),
      assetLove: pickOne(assetLove),
      primarySymbol: pickOne(symPool),
      strategyNotes: pickOne(notesPool),
    },
    deployment: {
      paperStartingCash: 1000 + randomInt(99_000),
      deploymentAcknowledged: true,
    },
  };
}

function randomMarketsAndAssets(): { market_selection: string[]; asset_selection: string[] } {
  const roll = randomInt(3);
  if (roll === 0) {
    return { market_selection: pickNonEmptySubset(MARKET_OPTIONS), asset_selection: [] };
  }
  if (roll === 1) {
    return { market_selection: [], asset_selection: pickNonEmptySubset(ASSET_TICKER_OPTIONS) };
  }
  return {
    market_selection: pickNonEmptySubset(MARKET_OPTIONS),
    asset_selection: pickNonEmptySubset(ASSET_TICKER_OPTIONS),
  };
}

interface Props {
  onSubmit: (payload: { name: string; execution_mode: string; config: BotConfig }) => Promise<void>;
  onCancel: () => void;
}

type QuestionType = 'text' | 'radio' | 'checkbox' | 'slider' | 'number';

interface Question {
  id: string;
  section: string;
  question: string;
  type: QuestionType;
  options?: { value: any; label: string; desc?: string }[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

const QUESTIONS: Question[] = [
  {
    id: 'name', section: 'Basic Info', question: 'What should we call your bot?',
    type: 'text', placeholder: 'e.g. Volatility Hunter',
  },
  {
    id: 'execution_mode', section: 'Basic Info', question: 'How should your bot execute trades?',
    type: 'radio', options: [
      { value: 'paper', label: 'Paper Trading', desc: 'Simulated trades · no real calls' },
      { value: 'demo_live', label: 'Deriv Demo', desc: 'Real API · demo money' },
    ],
  },
  {
    id: 'risk_profile', section: 'Risk & Execution', question: 'What is your risk appetite?',
    type: 'radio', options: [
      { value: 'conservative', label: 'Conservative', desc: 'Smaller positions · strict stops' },
      { value: 'moderate', label: 'Moderate', desc: 'Balanced risk-reward' },
      { value: 'aggressive', label: 'Aggressive', desc: 'Larger positions · wider stops' },
    ],
  },
  {
    id: 'market_selection', section: 'Markets', question: 'Which markets should your bot trade?',
    type: 'checkbox', options: [
      { value: 'VOL100-USD', label: 'Volatility 100' },
      { value: 'VOL75-USD', label: 'Volatility 75' },
      { value: 'VOL50-USD', label: 'Volatility 50' },
      { value: 'VOL25-USD', label: 'Volatility 25' },
    ],
  },
  {
    id: 'asset_selection', section: 'Assets', question: 'Which assets should your bot trade?',
    type: 'checkbox', options: [
      { value: 'R_10', label: 'Rise/Fall 10' },
      { value: 'R_25', label: 'Rise/Fall 25' },
      { value: 'R_50', label: 'Rise/Fall 50' },
      { value: 'R_75', label: 'Rise/Fall 75' },
      { value: 'R_100', label: 'Rise/Fall 100' },
      { value: 'frxEURUSD', label: 'EUR/USD' },
      { value: 'frxGBPUSD', label: 'GBP/USD' },
      { value: 'frxUSDJPY', label: 'USD/JPY' },
      { value: 'cryBTCUSD', label: 'BTC/USD' },
      { value: 'cryETHUSD', label: 'ETH/USD' },
    ],
  },
  {
    id: 'contract_types', section: 'Contracts', question: 'Which contract types may your bot use?',
    type: 'checkbox', options: [
      { value: 'CALL', label: 'Call / Put', desc: 'Classic rise/fall' },
      { value: 'PUT', label: 'Put (bearish)', desc: 'Downward bet' },
      { value: 'ACCU', label: 'Accumulator', desc: 'Low volatility multiplier' },
      { value: 'MULTUP', label: 'Multiplier Up', desc: 'Leveraged upside' },
    ],
  },
  {
    id: 'technical_indicators', section: 'Signal Sources', question: 'Which technical indicators?',
    type: 'checkbox', options: [
      { value: 'rsi', label: 'RSI', desc: 'Overbought / oversold' },
      { value: 'macd', label: 'MACD', desc: 'Momentum & trend' },
      { value: 'bollinger', label: 'Bollinger Bands', desc: 'Volatility extremes' },
    ],
  },
  {
    id: 'ai_patterns', section: 'Signal Sources', question: 'Enable AI pattern detection?',
    type: 'radio', options: [
      { value: true, label: 'Yes', desc: 'Use LLM + heuristics to detect chart patterns' },
      { value: false, label: 'No', desc: 'Skip AI analysis' },
    ],
  },
  {
    id: 'news_weight', section: 'Signal Sources', question: 'How much weight should news sentiment have?',
    type: 'slider', min: 0, max: 1, step: 0.1,
  },
  {
    id: 'stake_amount', section: 'Execution Parameters', question: 'Stake amount per trade (USD)?',
    type: 'number', min: 1, max: 1000,
  },
  {
    id: 'max_daily_trades', section: 'Execution Parameters', question: 'Maximum trades per day?',
    type: 'number', min: 1, max: 500,
  },
];

const SECTIONS = [
  'Basic Info',
  'Risk & Execution',
  'Agent Policy',
  'Markets',
  'Assets',
  'Contracts',
  'Signal Sources',
  'Execution Parameters',
  'Auto-stop & limits',
];

type FormData = Record<string, any>;

export function BotCreationWizard({ onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<FormData>({
    name: '',
    execution_mode: 'paper',
    risk_profile: 'moderate',
    market_selection: ['VOL100-USD'],
    asset_selection: [] as string[],
    contract_types: ['CALL', 'PUT'],
    technical_indicators: ['rsi'],
    ai_patterns: false,
    news_weight: 0.3,
    stake_amount: 10,
    max_daily_trades: 20,
    agentPolicy: defaultBotAgentPolicy(),
    target_payout_usd: 100,
    risk_tolerance_percent: 50,
    paper_bankroll: 10000,
    auto_stop_mode: 'first_hit' as AutoStopMode,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, value: any) => setForm((f) => ({ ...f, [id]: value }));

  const toggleInArray = (id: string, value: any) => {
    setForm((f) => {
      const arr: any[] = f[id] || [];
      if (arr.includes(value)) return { ...f, [id]: arr.filter((x) => x !== value) };
      return { ...f, [id]: [...arr, value] };
    });
  };

  const randomizeAll = () => {
    setError(null);
    const { market_selection, asset_selection } = randomMarketsAndAssets();
    const ma = randomAgentPolicy();
    const execModes = ['paper', 'demo_live'] as const;
    const risks = ['conservative', 'moderate', 'aggressive'] as const;
    const stopModes: AutoStopMode[] = ['first_hit', 'target_only', 'risk_only'];
    const contractOpts = ['CALL', 'PUT', 'ACCU', 'MULTUP'] as const;
    const indOpts = ['rsi', 'macd', 'bollinger'] as const;

    setForm({
      name: randomBotName(),
      execution_mode: pickOne(execModes),
      risk_profile: pickOne(risks),
      market_selection,
      asset_selection,
      contract_types: pickNonEmptySubset(contractOpts),
      technical_indicators: pickNonEmptySubset(indOpts),
      ai_patterns: randomInt(2) === 1,
      news_weight: Math.round(randomInt(11)) / 10,
      stake_amount: 1 + randomInt(1000),
      max_daily_trades: 1 + randomInt(500),
      agentPolicy: ma,
      target_payout_usd: randomInt(500_001),
      risk_tolerance_percent: randomInt(21) * 5,
      paper_bankroll: 100 + randomInt(99_900),
      auto_stop_mode: pickOne(stopModes),
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!form.name?.trim()) {
      setError('Name is required');
      return;
    }
    const mkt = (form.market_selection || []) as string[];
    const ast = (form.asset_selection || []) as string[];
    if (mkt.length === 0 && ast.length === 0) {
      setError('Select at least one market or asset');
      return;
    }
    if ((form.contract_types || []).length === 0) {
      setError('Select at least one contract type');
      return;
    }

    const baseCfg = defaultBotConfig();
    const ap: BotAgentPolicy = {
      ...form.agentPolicy,
      identity: {
        ...form.agentPolicy.identity,
        displayName:
          form.agentPolicy.identity.displayName?.trim() ||
          form.name.trim() ||
          'Trader',
      },
    };
    const config: BotConfig = {
      ...baseCfg,
      riskProfile: form.risk_profile,
      marketSelection: form.market_selection,
      assetSelection: (form.asset_selection || []) as string[],
      contractTypes: form.contract_types,
      indicators: {
        technical: form.technical_indicators || [],
        aiPatterns: !!form.ai_patterns,
        newsWeight: Number(form.news_weight) || 0,
      },
      agentPolicy: ap,
      execution: {
        ...baseCfg.execution,
        stakeAmount: Number(form.stake_amount) || 10,
        maxDailyTrades: Number(form.max_daily_trades) || 20,
        stopLossPercent: form.risk_profile === 'conservative' ? 3 : form.risk_profile === 'aggressive' ? 8 : 5,
        takeProfitPercent: form.risk_profile === 'conservative' ? 5 : form.risk_profile === 'aggressive' ? 15 : 10,
        targetPayoutUsd: Math.max(0, Number(form.target_payout_usd) || 0),
        riskTolerancePercent: Math.min(100, Math.max(0, Number(form.risk_tolerance_percent) || 0)),
        paperBankroll: Math.max(100, Number(form.paper_bankroll) || 10000),
        autoStopMode: form.auto_stop_mode,
      },
    };

    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        execution_mode: form.execution_mode,
        config,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to create bot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5 pr-1">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-black font-mono text-white tracking-tight">DEPLOY NEW BOT</h2>
          <p className="text-[11px] font-mono text-white/40 mt-1">
            Answer the questions below to customize your AI trading agent.
          </p>
        </div>
        <button
          type="button"
          onClick={randomizeAll}
          className="shrink-0 px-3 py-2 rounded text-[10px] font-mono uppercase tracking-wider font-bold transition"
          style={{
            background: 'rgba(232,180,94,0.12)',
            border: `1px solid ${GOLD}`,
            color: GOLD,
          }}
        >
          Randomize
        </button>
      </div>

      {SECTIONS.map((section) => {
        if (section === 'Agent Policy') {
          return (
            <div
              key={section}
              className="p-4 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3" style={{ color: GOLD }}>
                {section}
              </div>
              <p className="text-[10px] font-mono text-white/40 mb-4">
                Prerequisite style setup (paper-agent terms). Tunes confidence threshold, news weight, and stake on top of your risk profile.
              </p>
              <AgentPolicySection
                policy={form.agentPolicy}
                setPolicy={(p) => update('agentPolicy', p)}
              />
            </div>
          );
        }
        if (section === 'Auto-stop & limits') {
          return (
            <div
              key={section}
              className="p-4 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3" style={{ color: GOLD }}>
                {section}
              </div>
              <p className="text-[10px] font-mono text-white/40 mb-4">
                Stops the bot when session P&amp;L (since you pressed Start) hits your target or max loss. Set both to 0 to disable auto-stop.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-white/70 mb-2">Stop mode</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(
                      [
                        ['first_hit', 'Whichever hits first', 'Target profit or max loss'],
                        ['target_only', 'Target profit only', 'Ignore max loss rule'],
                        ['risk_only', 'Max loss only', 'Ignore profit target'],
                      ] as const
                    ).map(([value, label, desc]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => update('auto_stop_mode', value)}
                        className="text-left px-3 py-2.5 rounded transition"
                        style={{
                          background:
                            form.auto_stop_mode === value ? 'rgba(232,180,94,0.12)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${form.auto_stop_mode === value ? GOLD : 'rgba(255,255,255,0.08)'}`,
                        }}
                      >
                        <div className="text-xs font-mono font-bold text-white">{label}</div>
                        <div className="text-[10px] font-mono text-white/40 mt-0.5">{desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <QuestionField
                  q={{
                    id: 'target_payout_usd',
                    section: '',
                    question: 'Target payout (USD, session)',
                    type: 'number',
                    min: 0,
                    max: 1_000_000,
                  }}
                  value={form.target_payout_usd}
                  onChange={(v) => update('target_payout_usd', v)}
                  onToggle={() => {}}
                />
                <div>
                  <label className="block text-xs font-mono text-white/70 mb-2">
                    Risk tolerance ({form.risk_tolerance_percent}% of bankroll = max session loss)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={form.risk_tolerance_percent}
                    onChange={(e) => update('risk_tolerance_percent', Number(e.target.value))}
                    className="w-full accent-[#E8B45E]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-white/70 mb-2">Paper bankroll (for risk %)</label>
                  <input
                    type="number"
                    min={100}
                    max={10_000_000}
                    value={form.paper_bankroll}
                    onChange={(e) => update('paper_bankroll', Number(e.target.value) || 10000)}
                    className="w-full px-3 py-2 rounded text-sm font-mono text-white bg-white/[0.03] border border-white/10 focus:outline-none focus:border-[#E8B45E]/60 transition"
                  />
                </div>
              </div>
            </div>
          );
        }
        const sectionQs = QUESTIONS.filter((q) => q.section === section);
        return (
          <div
            key={section}
            className="p-4 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] mb-3" style={{ color: GOLD }}>
              {section}
            </div>
            <div className="space-y-4">
              {sectionQs.map((q) => (
                <QuestionField
                  key={q.id}
                  q={q}
                  value={form[q.id]}
                  onChange={(v) => update(q.id, v)}
                  onToggle={(v) => toggleInArray(q.id, v)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {error && (
        <div className="text-xs font-mono text-red-400 px-3 py-2 rounded" style={{ background: 'rgba(255,0,51,0.08)', border: '1px solid rgba(255,0,51,0.25)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-2 sticky bottom-0 bg-bg-primary pt-3">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 rounded text-xs font-mono uppercase tracking-wider text-white/60 hover:text-white transition"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 px-4 py-2.5 rounded text-xs font-mono uppercase tracking-wider font-bold disabled:opacity-50 transition"
          style={{
            background: `linear-gradient(135deg, ${GOLD} 0%, #D09A3A 100%)`,
            color: '#000',
            boxShadow: submitting ? 'none' : `0 0 20px ${GOLD}50`,
          }}
        >
          {submitting ? 'Deploying…' : 'Deploy Bot'}
        </button>
      </div>
    </div>
  );
}

function PolicyChoice({
  label,
  desc,
  selected,
  onSelect,
}: {
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left px-3 py-2.5 rounded transition w-full"
      style={{
        background: selected ? 'rgba(232,180,94,0.12)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${selected ? GOLD : 'rgba(255,255,255,0.08)'}`,
      }}
    >
      <div className="text-xs font-mono font-bold text-white">{label}</div>
      <div className="text-[10px] font-mono text-white/40 mt-0.5">{desc}</div>
    </button>
  );
}

function AgentPolicySection({
  policy,
  setPolicy,
}: {
  policy: BotAgentPolicy;
  setPolicy: (p: BotAgentPolicy) => void;
}) {
  const setIdentity = (patch: Partial<BotAgentPolicy['identity']>) =>
    setPolicy({ ...policy, identity: { ...policy.identity, ...patch } });
  const setTrading = (patch: Partial<BotAgentPolicy['tradingStyle']>) =>
    setPolicy({ ...policy, tradingStyle: { ...policy.tradingStyle, ...patch } });
  const setRiskPol = (patch: Partial<BotAgentPolicy['risk']>) =>
    setPolicy({ ...policy, risk: { ...policy.risk, ...patch } });
  const setPref = (patch: Partial<BotAgentPolicy['preferences']>) =>
    setPolicy({ ...policy, preferences: { ...policy.preferences, ...patch } });
  const setDep = (patch: Partial<BotAgentPolicy['deployment']>) =>
    setPolicy({ ...policy, deployment: { ...policy.deployment, ...patch } });

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Display name (optional)</div>
        <input
          type="text"
          value={policy.identity.displayName}
          onChange={(e) => setIdentity({ displayName: e.target.value.slice(0, 64) })}
          placeholder="Defaults to bot name"
          className="w-full px-3 py-2 rounded text-sm font-mono text-white bg-white/[0.03] border border-white/10 focus:outline-none focus:border-[#E8B45E]/60 transition"
        />
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Personality</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <PolicyChoice
            label="Careful guardian"
            desc="Stricter signals"
            selected={policy.identity.personality === 'careful_guardian'}
            onSelect={() => setIdentity({ personality: 'careful_guardian' })}
          />
          <PolicyChoice
            label="Balanced trader"
            desc="Default tilt"
            selected={policy.identity.personality === 'balanced_trader'}
            onSelect={() => setIdentity({ personality: 'balanced_trader' })}
          />
          <PolicyChoice
            label="Bold adventurer"
            desc="More aggressive entries"
            selected={policy.identity.personality === 'bold_adventurer'}
            onSelect={() => setIdentity({ personality: 'bold_adventurer' })}
          />
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Decision style</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <PolicyChoice
            label="Gut instinct"
            desc="Reacts faster"
            selected={policy.identity.decisionStyle === 'gut_instinct'}
            onSelect={() => setIdentity({ decisionStyle: 'gut_instinct' })}
          />
          <PolicyChoice
            label="Deep analyst"
            desc="Higher conviction bar"
            selected={policy.identity.decisionStyle === 'deep_analyst'}
            onSelect={() => setIdentity({ decisionStyle: 'deep_analyst' })}
          />
          <PolicyChoice
            label="Patient observer"
            desc="Fewer trades"
            selected={policy.identity.decisionStyle === 'patient_observer'}
            onSelect={() => setIdentity({ decisionStyle: 'patient_observer' })}
          />
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Trading instinct</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            [
              ['trend_chaser', 'Trend chaser', 'Follow momentum'],
              ['value_hunter', 'Value hunter', 'Mean reversion tilt'],
              ['reversal_spotter', 'Reversal spotter', 'Counter-trend'],
              ['speed_demon', 'Speed demon', 'Short horizon'],
            ] as const
          ).map(([id, label, desc]) => (
            <PolicyChoice
              key={id}
              label={label}
              desc={desc}
              selected={policy.tradingStyle.instinct === id}
              onSelect={() => setTrading({ instinct: id as TradingInstinct })}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Time patience</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              ['lightning_day', 'Lightning day', 'Tight windows'],
              ['swing_rider', 'Swing rider', 'Balanced holds'],
              ['long_term_visionary', 'Long-term', 'Longer horizon'],
            ] as const
          ).map(([id, label, desc]) => (
            <PolicyChoice
              key={id}
              label={label}
              desc={desc}
              selected={policy.tradingStyle.patience === id}
              onSelect={() => setTrading({ patience: id as TimePatience })}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Profit dream</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              ['quick_wins', 'Quick wins', 'Steady clips'],
              ['big_moves', 'Big moves', 'Larger swings'],
              ['wealth_builder', 'Wealth builder', 'Balanced compounding'],
            ] as const
          ).map(([id, label, desc]) => (
            <PolicyChoice
              key={id}
              label={label}
              desc={desc}
              selected={policy.tradingStyle.profitDream === id}
              onSelect={() => setTrading({ profitDream: id as ProfitDream })}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Money approach</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              ['fixed_safe', 'Fixed & safe', 'Stable sizing'],
              ['smart_scaling', 'Smart scaling', 'Confidence-aware'],
              ['aggressive_sizer', 'Aggressive sizer', 'Larger when confident'],
            ] as const
          ).map(([id, label, desc]) => (
            <PolicyChoice
              key={id}
              label={label}
              desc={desc}
              selected={policy.risk.moneyApproach === id}
              onSelect={() => setRiskPol({ moneyApproach: id as MoneyApproach })}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Protection mindset</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(
            [
              ['tight_guardian', 'Tight guardian', 'Stricter guardrails'],
              ['flexible', 'Flexible', 'Balanced'],
              ['hands_off', 'Hands-off', 'Let legs run'],
            ] as const
          ).map(([id, label, desc]) => (
            <PolicyChoice
              key={id}
              label={label}
              desc={desc}
              selected={policy.risk.protection === id}
              onSelect={() => setRiskPol({ protection: id as ProtectionMindset })}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Market sense</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <PolicyChoice
            label="Fixed rules"
            desc="Technical / quant path"
            selected={policy.preferences.marketSense === 'fixed_rules'}
            onSelect={() => setPref({ marketSense: 'fixed_rules' })}
          />
          <PolicyChoice
            label="Mood reader"
            desc="Higher news weight"
            selected={policy.preferences.marketSense === 'mood_reader'}
            onSelect={() => setPref({ marketSense: 'mood_reader' })}
          />
        </div>
      </div>
      <div>
        <div className="text-[10px] font-mono uppercase text-white/35 mb-2">Asset focus</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(
            [
              ['stocks_fan', 'Stocks fan', 'Vol indices'],
              ['forex_pro', 'Forex pro', 'Synthetic FX'],
              ['crypto_rebel', 'Crypto rebel', 'High-vol synth'],
              ['all_rounder', 'All-rounder', 'Mixed'],
            ] as const
          ).map(([id, label, desc]) => (
            <PolicyChoice
              key={id}
              label={label}
              desc={desc}
              selected={policy.preferences.assetLove === id}
              onSelect={() => setPref({ assetLove: id as AssetLove })}
            />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase text-white/35 mb-1">Primary symbol (optional)</label>
        <input
          type="text"
          value={policy.preferences.primarySymbol}
          onChange={(e) =>
            setPref({
              primarySymbol: e.target.value.replace(/[^\w]/g, '').slice(0, 32),
            })
          }
          className="w-full px-3 py-2 rounded text-sm font-mono text-white bg-white/[0.03] border border-white/10 focus:outline-none focus:border-[#E8B45E]/60 transition"
        />
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase text-white/35 mb-1">Strategy notes</label>
        <textarea
          value={policy.preferences.strategyNotes}
          onChange={(e) => setPref({ strategyNotes: e.target.value.slice(0, 500) })}
          rows={2}
          className="w-full px-3 py-2 rounded text-xs font-mono text-white/90 bg-white/[0.03] border border-white/10 focus:outline-none focus:border-[#E8B45E]/60 transition"
        />
      </div>
      <div>
        <label className="block text-[10px] font-mono uppercase text-white/35 mb-1">Paper starting cash (reference)</label>
        <input
          type="number"
          min={100}
          max={1_000_000}
          value={policy.deployment.paperStartingCash}
          onChange={(e) =>
            setDep({
              paperStartingCash: Math.max(100, Math.min(1_000_000, Math.round(Number(e.target.value) || 10000))),
            })
          }
          className="w-full max-w-xs px-3 py-2 rounded text-sm font-mono text-white bg-white/[0.03] border border-white/10"
        />
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={policy.deployment.deploymentAcknowledged}
          onChange={(e) => setDep({ deploymentAcknowledged: e.target.checked })}
          className="mt-1"
        />
        <span className="text-[11px] text-white/70">
          I understand simulated trading; live Deriv trading requires separate auth and risk controls.
        </span>
      </label>
    </div>
  );
}

function QuestionField({
  q,
  value,
  onChange,
  onToggle,
}: {
  q: Question;
  value: any;
  onChange: (v: any) => void;
  onToggle: (v: any) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-mono text-white/70 mb-2">{q.question}</label>
      {q.type === 'text' && (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value.slice(0, 64))}
          placeholder={q.placeholder}
          className="w-full px-3 py-2 rounded text-sm font-mono text-white bg-white/[0.03] border border-white/10 focus:outline-none focus:border-[#E8B45E]/60 transition"
        />
      )}
      {q.type === 'number' && (
        <input
          type="number"
          value={value ?? ''}
          min={q.min}
          max={q.max}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="w-full px-3 py-2 rounded text-sm font-mono text-white bg-white/[0.03] border border-white/10 focus:outline-none focus:border-[#E8B45E]/60 transition"
        />
      )}
      {q.type === 'slider' && (
        <div>
          <input
            type="range"
            min={q.min}
            max={q.max}
            step={q.step}
            value={value ?? q.min ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-[#E8B45E]"
          />
          <div className="flex justify-between text-[10px] font-mono text-white/40 mt-1">
            <span>Ignore (0)</span>
            <span className="text-[#E8B45E]">{((value ?? 0) * 100).toFixed(0)}%</span>
            <span>High (1)</span>
          </div>
        </div>
      )}
      {q.type === 'radio' && q.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {q.options.map((opt) => {
            const selected = value === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onChange(opt.value)}
                className="text-left px-3 py-2.5 rounded transition"
                style={{
                  background: selected ? 'rgba(232,180,94,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selected ? GOLD : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="text-xs font-mono font-bold text-white">{opt.label}</div>
                {opt.desc && <div className="text-[10px] font-mono text-white/40 mt-0.5">{opt.desc}</div>}
              </button>
            );
          })}
        </div>
      )}
      {q.type === 'checkbox' && q.options && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {q.options.map((opt) => {
            const arr: any[] = Array.isArray(value) ? value : [];
            const selected = arr.includes(opt.value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onToggle(opt.value)}
                className="text-left px-3 py-2.5 rounded transition"
                style={{
                  background: selected ? 'rgba(232,180,94,0.12)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${selected ? GOLD : 'rgba(255,255,255,0.08)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm flex items-center justify-center"
                    style={{ background: selected ? GOLD : 'transparent', border: `1px solid ${selected ? GOLD : 'rgba(255,255,255,0.2)'}` }}
                  >
                    {selected && <span className="text-[8px] text-black font-bold">✓</span>}
                  </div>
                  <span className="text-xs font-mono font-bold text-white">{opt.label}</span>
                </div>
                {opt.desc && <div className="text-[10px] font-mono text-white/40 mt-0.5 ml-5">{opt.desc}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
