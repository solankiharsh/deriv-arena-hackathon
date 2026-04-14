'use client';

const GOLD = '#E8B45E';

import { useState, useCallback } from 'react';
import { Settings, Shield, TrendingUp, Save, Loader2, CheckCircle2, AlertTriangle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/authStore';
import { saveAgentConfig } from '@/lib/api';
import { OnboardingChecklist } from '@/components/arena/OnboardingChecklist';
import type { OnboardingTask } from '@/lib/types';

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

    // Market & Contract selection
    const [selectedMarket, setSelectedMarket] = useState('1HZ100V'); // Volatility 100
    const [enabledContracts, setEnabledContracts] = useState({
        ACCU: true,
        MULTUP: false,
        MULTDOWN: false,
        CALL: true,
        PUT: false,
    });

    // Data source toggles (from AgentDataFlow)
    const [enabledFeeds, setEnabledFeeds] = useState({
        deriv_ticks: true,
        sentiment: true,
        pattern: true,
        partner: false,
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
            toast.success('Agent config saved');
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err?.message || 'Failed to save config');
        } finally {
            setSavingConfig(false);
        }
    }, [stakeAmount, targetPayout, riskScore, selectedMarket, enabledContracts, enabledFeeds]);

    const toggleFeed = (key: keyof typeof enabledFeeds) => {
        setEnabledFeeds(prev => ({ ...prev, [key]: !prev[key] }));
    };

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
                    <p className="text-[10px] mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        Select the synthetic index your agent will trade on.
                    </p>
                    {['1HZ100V', '1HZ75V', '1HZ50V', 'R_10', 'R_25', 'R_50', 'R_75', 'R_100'].map((market) => (
                        <button
                            key={market}
                            onClick={() => setSelectedMarket(market)}
                            className={`w-full py-1.5 px-2 text-xs font-mono text-left border rounded transition-colors ${
                                selectedMarket === market 
                                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                                    : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04]'
                            }`}
                        >
                            {market}
                        </button>
                    ))}
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
                        {savingConfig ? 'Deploying...' : 'Deploy Agent'}
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
                                onClick={() => toggleFeed(key as keyof typeof enabledFeeds)}
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
