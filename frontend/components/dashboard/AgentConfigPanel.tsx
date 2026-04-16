'use client';

const GOLD = '#E8B45E';

import { useState, useCallback, useEffect } from 'react';
import { useArenaFeedPreferences } from '@/hooks/useArenaFeedPreferences';
import { Bot, Settings, Shield, TrendingUp, Save, Loader2, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { saveAgentConfig } from '@/lib/api';
import { OnboardingChecklist } from '@/components/arena/OnboardingChecklist';
import type { OnboardingTask } from '@/lib/types';
import type { AgentPolicy } from '@/lib/agents';
import { loadAgentPolicyFromStorage, randomAgentPolicy, saveAgentPolicyToStorage } from '@/lib/agents';
import { AGENT_POLICY_UI, DERIV_MARKET_PRESET_GROUPS } from '@/lib/agents/agentPolicyCopy';
import {
  AgentPolicyIdentityFields,
  AgentPolicyLaunchFields,
  AgentPolicyPreferencesFields,
  AgentPolicyRiskFields,
  AgentPolicyTradingFields,
} from '@/components/dashboard/AgentPolicyStepFields';

// ── Section Wrapper ──────────────────────────────────────────────

function ConfigSection({
    title,
    icon: Icon,
    children,
    defaultOpen = true,
}: {
    title: string;
    icon: any;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="border border-white/[0.06] rounded overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
                    <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">{title}</span>
                </div>
                <ChevronDown
                    className="w-3.5 h-3.5 transition-transform duration-300 ease-out"
                    style={{ color: 'rgba(255,255,255,0.3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </button>
            <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
            >
                <div className="overflow-hidden">
                    <div
                        className="px-3 py-3 space-y-3 border-t border-white/[0.04] transition-opacity duration-300 ease-out"
                        style={{ opacity: open ? 1 : 0 }}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── SliderField ──────────────────────────────────────────────────

function SliderField({
    label,
    value,
    onChange,
    min,
    max,
    step,
    unit,
    description,
}: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    min: number;
    max: number;
    step: number;
    unit?: string;
    description?: string;
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</label>
                <span className="text-xs font-mono font-bold" style={{ color: GOLD }}>
                    {value}{unit}
                </span>
            </div>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-full h-1 bg-white/[0.08] rounded appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(232,180,94,0.4)]"
                style={{ accentColor: GOLD }}
            />
            {description && <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>{description}</p>}
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────

export function AgentConfigPanel() {
    const { agent, onboardingTasks, onboardingProgress } = useAuthStore();
    const { selectedMarket, enabledFeeds, setSelectedMarket, toggleFeed } = useArenaFeedPreferences();

    const [policy, setPolicy] = useState<AgentPolicy>(() => ({ ...loadAgentPolicyFromStorage() }));

    useEffect(() => {
        if (policy.preferences.primarySymbol === selectedMarket) return;
        setSelectedMarket(policy.preferences.primarySymbol);
    }, [policy.preferences.primarySymbol, selectedMarket, setSelectedMarket]);

    const selectMarket = useCallback(
        (market: string) => {
            setSelectedMarket(market);
            setPolicy((p) => ({
                ...p,
                preferences: { ...p.preferences, primarySymbol: market.replace(/[^\w]/g, '').slice(0, 32) },
            }));
        },
        [setSelectedMarket],
    );

    // Deriv trading params (configurable)
    const [stakeAmount, setStakeAmount] = useState(10);
    const [targetPayout, setTargetPayout] = useState(100);
    const [riskScore, setRiskScore] = useState(50); // 0-100

    // Map numeric risk score to risk level
    const getRiskLevel = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' => {
        if (score < 25) return 'LOW';
        if (score < 50) return 'MEDIUM';
        if (score < 75) return 'HIGH';
        return 'EXTREME';
    };

    // Contract selection (persisted via saveAgentConfig; market + feeds use Command Center localStorage)
    const [enabledContracts, setEnabledContracts] = useState({
        ACCU: true,
        MULTUP: false,
        MULTDOWN: false,
        CALL: true,
        PUT: false,
    });

    // Persist trading config to backend
    const [savingConfig, setSavingConfig] = useState(false);
    const handleSaveConfig = useCallback(async () => {
        setSavingConfig(true);
        try {
            await saveAgentConfig({
                stakeAmount,
                targetPayout,
                riskLevel: getRiskLevel(riskScore),
                selectedMarket,
                enabledContracts,
                enabledFeeds,
            });
            saveAgentPolicyToStorage(policy);
            toast.success('Agent config and trading persona saved', {
                description:
                    'Data Feeds + Market apply to this browser immediately. Use the center Paper swarm column (Arena / Command Center) to run steps on ticks or the simulator.',
                duration: 8000,
            });
        } catch (err: unknown) {
            saveAgentPolicyToStorage(policy);
            const msg =
                err instanceof Error
                    ? err.message
                    : typeof err === 'object' && err !== null && 'message' in err
                      ? String((err as { message: unknown }).message)
                      : 'Failed to save config';
            toast.error(`${msg} — trading persona still saved in this browser.`);
        } finally {
            setSavingConfig(false);
        }
    }, [stakeAmount, targetPayout, riskScore, selectedMarket, enabledContracts, enabledFeeds, policy]);

    const toggleContract = (key: keyof typeof enabledContracts) => {
        setEnabledContracts(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (!agent) return null;

    return (
        <div className="bg-[#12121a]/50 backdrop-blur-xl border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
                <Settings className="w-4 h-4" style={{ color: GOLD }} />
                <h3 className="text-sm font-bold text-white">Agent Configuration</h3>
            </div>

            <div className="p-3 space-y-3">
                {/* Deriv Market Selection */}
                <ConfigSection title="Market" icon={TrendingUp}>
                    <p className="text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {AGENT_POLICY_UI.marketBlurb}
                    </p>
                    <p className="text-[10px] mb-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        {AGENT_POLICY_UI.marketFamiliesBlurb}
                    </p>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-white/30 mb-1">Volatility</div>
                    <div className="space-y-1 mb-3">
                        {(['1HZ100V', '1HZ75V', '1HZ50V'] as const).map((market) => (
                            <button
                                key={market}
                                onClick={() => selectMarket(market)}
                                className={`w-full py-1.5 px-2 text-xs font-mono text-left border rounded transition-colors ${
                                    selectedMarket === market
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                        : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04]'
                                }`}
                            >
                                {market}
                            </button>
                        ))}
                    </div>
                    <div className="text-[9px] font-mono uppercase tracking-wider text-white/30 mb-1">Jump</div>
                    <div className="space-y-1">
                        {(['R_10', 'R_25', 'R_50', 'R_75', 'R_100'] as const).map((market) => (
                            <button
                                key={market}
                                onClick={() => selectMarket(market)}
                                className={`w-full py-1.5 px-2 text-xs font-mono text-left border rounded transition-colors ${
                                    selectedMarket === market
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                                        : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04]'
                                }`}
                            >
                                {market}
                            </button>
                        ))}
                    </div>
                    <p className="text-[9px] mt-3 mb-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.28)' }}>
                        More Deriv underlyings (same WebSocket tick stream; symbol must exist for your app_id / account).
                        See{' '}
                        <a
                            href="https://developers.deriv.com/docs/data/ticks/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-200/70 hover:underline"
                        >
                            Deriv ticks docs
                        </a>{' '}
                        and{' '}
                        <a
                            href="https://developers.deriv.com/docs/data/active-symbols/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-200/70 hover:underline"
                        >
                            active symbols
                        </a>
                        .
                    </p>
                    {DERIV_MARKET_PRESET_GROUPS.map((g) => (
                        <div key={g.label} className="mb-3 last:mb-0">
                            <div className="text-[9px] font-mono uppercase tracking-wider text-white/30 mb-1">{g.label}</div>
                            <div className="flex flex-wrap gap-1">
                                {g.symbols.map((sym) => (
                                    <button
                                        key={sym}
                                        type="button"
                                        onClick={() => selectMarket(sym)}
                                        className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors ${
                                            selectedMarket === sym
                                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                                : 'bg-white/[0.03] border-white/[0.08] text-white/55 hover:bg-white/[0.06]'
                                        }`}
                                    >
                                        {sym}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </ConfigSection>

                <ConfigSection title="Trading persona (paper)" icon={Bot} defaultOpen={false}>
                    <p className="text-[10px] mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {AGENT_POLICY_UI.arenaPersonaIntro}
                    </p>
                    <button
                        type="button"
                        onClick={() => {
                            setPolicy(randomAgentPolicy());
                            toast.message('Random persona — Deploy Agent to persist');
                        }}
                        className="text-[10px] font-mono uppercase px-2 py-1 rounded border border-white/15 text-white/50 hover:bg-white/5 mb-4"
                    >
                        {AGENT_POLICY_UI.randomize}
                    </button>
                    <div className="space-y-5 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
                        <div>
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/45 mb-2">Identity</div>
                            <AgentPolicyIdentityFields policy={policy} setPolicy={setPolicy} />
                        </div>
                        <div className="border-t border-white/[0.06] pt-4">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/45 mb-2">Trading style</div>
                            <AgentPolicyTradingFields policy={policy} setPolicy={setPolicy} />
                        </div>
                        <div className="border-t border-white/[0.06] pt-4">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/45 mb-2">Risk & paper bankroll</div>
                            <AgentPolicyRiskFields policy={policy} setPolicy={setPolicy} />
                        </div>
                        <div className="border-t border-white/[0.06] pt-4">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/45 mb-2">Preferences</div>
                            <AgentPolicyPreferencesFields policy={policy} setPolicy={setPolicy} />
                        </div>
                        <div className="border-t border-white/[0.06] pt-4">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-white/45 mb-2">Launch</div>
                            <AgentPolicyLaunchFields policy={policy} setPolicy={setPolicy} />
                        </div>
                    </div>
                </ConfigSection>

                {/* Contract Types */}
                <ConfigSection title="Contract Types" icon={Shield} defaultOpen={false}>
                    <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Enable which contract types your agent can trade.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries({
                            ACCU: { label: 'Accumulators', desc: 'Growth during volatility contraction' },
                            MULTUP: { label: 'Multipliers (Up)', desc: 'Trend following - rising markets' },
                            MULTDOWN: { label: 'Multipliers (Down)', desc: 'Trend following - falling markets' },
                            CALL: { label: 'Vanilla Call', desc: 'Simple high/low direction' },
                            PUT: { label: 'Vanilla Put', desc: 'Simple high/low direction' },
                        }).map(([key, { label, desc }]) => (
                            <button
                                key={key}
                                onClick={() => toggleContract(key as keyof typeof enabledContracts)}
                                className={`py-2 px-2 text-xs border rounded transition-colors ${
                                    enabledContracts[key as keyof typeof enabledContracts]
                                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                        : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04]'
                                }`}
                            >
                                <span className="block font-semibold">{label}</span>
                                <span className="text-[9px] opacity-60">{desc}</span>
                            </button>
                        ))}
                    </div>
                </ConfigSection>

                {/* Trading Parameters */}
                <ConfigSection title="Risk Parameters" icon={TrendingUp} defaultOpen={false}>
                    <SliderField
                        label="Stake Amount"
                        value={stakeAmount}
                        onChange={setStakeAmount}
                        min={1}
                        max={100}
                        step={1}
                        unit=" USD"
                        description="USD stake per contract"
                    />
                    <SliderField
                        label="Target Payout"
                        value={targetPayout}
                        onChange={setTargetPayout}
                        min={10}
                        max={500}
                        step={10}
                        unit=" USD"
                        description="Auto-close when payout reaches"
                    />
                    <SliderField
                        label="Risk Tolerance"
                        value={riskScore}
                        onChange={setRiskScore}
                        min={0}
                        max={100}
                        step={25}
                        unit="%"
                        description="Higher = Aggressive, Lower = Conservative"
                    />
                    <div className="bg-amber-500/5 border border-amber-500/10 p-2 rounded flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-amber-400/80 leading-tight">
                            Trading parameters affect how your agent trades on the demo account.
                        </p>
                    </div>

                    <button
                        onClick={handleSaveConfig}
                        disabled={savingConfig}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 border transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer rounded"
                        style={{ background: 'rgba(232,180,94,0.08)', borderColor: 'rgba(232,180,94,0.3)', color: GOLD }}
                    >
                        {savingConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {savingConfig ? 'Saving…' : 'Deploy Agent'}
                    </button>
                </ConfigSection>

                {/* Data Sources */}
                <ConfigSection title="Data Feeds" icon={Shield} defaultOpen={false}>
                    <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Toggle which data streams your agent uses (from Command Center).
                    </p>
                    {Object.entries({
                        deriv_ticks: { label: 'Deriv Ticks', desc: 'Real-time synthetic tick data' },
                        sentiment: { label: 'News & Social', desc: 'Sentiment analysis' },
                        pattern: { label: 'Patterns', desc: 'Technical pattern recognition' },
                        partner: { label: 'Partner Rules', desc: 'Competition host rules' },
                    }).map(([key, { label, desc }]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
                        >
                            <div className="min-w-0">
                                <span className="text-xs font-semibold text-white block">{label}</span>
                                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{desc}</span>
                            </div>
                            <button
                                onClick={() => toggleFeed(key as 'deriv_ticks' | 'sentiment' | 'pattern' | 'partner')}
                                className={`relative w-8 h-4.5 rounded-full transition-colors cursor-pointer ${
                                    enabledFeeds[key as keyof typeof enabledFeeds]
                                    ? 'bg-emerald-500/30'
                                    : 'bg-white/[0.08]'
                                }`}
                            >
                                <div
                                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all ${
                                        enabledFeeds[key as keyof typeof enabledFeeds]
                                        ? 'left-4 bg-emerald-400'
                                        : 'left-0.5 bg-white/30'
                                    }`}
                                />
                            </button>
                        </div>
                    ))}
                </ConfigSection>

                {/* Onboarding Progress */}
                {onboardingProgress < 100 && (
                    <ConfigSection title="Onboarding" icon={CheckCircle2}>
                        <OnboardingChecklist
                            tasks={onboardingTasks}
                            completedTasks={onboardingTasks.filter((t: OnboardingTask) => t.status === 'VALIDATED').length}
                            totalTasks={onboardingTasks.length}
                        />
                    </ConfigSection>
                )}
            </div>
        </div>
    );
}
