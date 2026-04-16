'use client';

const GOLD = '#E8B45E';
const SURF = '#0C1020';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Pill, Crosshair, Swords, Drama, Rocket, Zap, ChevronDown, ListChecks, MessageSquare, TrendingUp, Clock, ArrowUpRight, ArrowDownRight, Activity, Eye, BarChart3, Users, Flame, Sparkles, Target, Globe } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { useAuthStore } from '@/store/authStore';
import { getArenaTasks, getAgentPositions, getAgentConversations } from '@/lib/api';
import type { AgentTaskType, Position, AgentConversationSummary } from '@/lib/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useArenaCommandFeeds } from '@/hooks/useArenaCommandFeeds';
import type { PartnerRules } from '@/lib/derivarena-api';

// ── Feed node definitions ───────────────────────────────────────

const FEEDS = [
    { id: 'deriv_ticks', label: 'Deriv Ticks', desc: 'Synthetic market feeds', icon: Activity, color: '#E8B45E' },
    { id: 'sentiment', label: 'News & Social', desc: 'Sentiment from X/Reddit', icon: Globe, color: '#818CF8' },
    { id: 'pattern', label: 'Patterns', desc: 'Technical indicators', icon: TrendingUp, color: '#34D399' },
    { id: 'partner', label: 'Partner', desc: 'Strategy overrides', icon: Swords, color: '#F472B6' },
];

const FEED_DETAILS: Record<string, {
    tagline: string;
    description: string;
    features: { icon: typeof Activity; title: string; desc: string }[];
    stats: { label: string; value: string }[];
}> = {
    deriv_ticks: {
        tagline: 'Real-time Synthetic Index Data',
        description: 'Live: connects to Deriv’s public options WebSocket for the symbol chosen in Agent Configuration (same transport as the paper agent). Use it as the ground-truth price path for downstream signals.',
        features: [
            { icon: Zap, title: 'Instant Ticks', desc: 'Sub-second tick updates for Volatility indices via Deriv Public WS' },
            { icon: Eye, title: 'Volatility Analysis', desc: 'Monitors volatility spikes and contraction patterns for ACCU/Multiplier timing' },
            { icon: BarChart3, title: 'Tick History', desc: 'Accesses historical tick data for backtesting strategy patterns' },
            { icon: Flame, title: 'Multi-Asset', desc: 'Monitors multiple synthetic indices simultaneously (VOL100, VOL75, etc.)' },
        ],
        stats: [
            { label: 'Tick latency', value: '<200ms' },
            { label: 'Indices tracked', value: '10+' },
            { label: 'Data source', value: 'Deriv WS' },
        ],
    },
    sentiment: {
        tagline: 'News & Social Sentiment Ingestion',
        description:
            'Phase 1 (implemented): fuses your local agent policy / strategy notes with rolling tick “stress” (σ of recent returns) when the Deriv feed is on. Planned: allowlisted third-party feeds behind server routes so API keys never ship to the browser.',
        features: [
            { icon: Target, title: 'X/Twitter Feed', desc: 'Planned — server-side fetch with strict allowlists and rate limits' },
            { icon: Activity, title: 'Reddit Analysis', desc: 'Planned — curated subreddit signals, not open scraping by default' },
            { icon: TrendingUp, title: 'News API', desc: 'Planned — hosted news/sentiment providers with schema validation' },
            { icon: Users, title: 'NLP Scoring', desc: 'Live today: policy-note channel; LLM scoring only when you wire a reviewed backend' },
        ],
        stats: [
            { label: 'Phase 1', value: 'Live' },
            { label: 'Social APIs', value: 'Planned' },
            { label: 'Keys', value: 'Server-only' },
        ],
    },
    pattern: {
        tagline: 'Technical Pattern Recognition',
        description:
            'Phase 1 (implemented): rolling per-tick volatility and a quiet / normal / agitated regime label from live returns. Planned: richer pattern detectors, walk-forward checks, and competition-specific overlays.',
        features: [
            { icon: Users, title: 'Volatility Contraction', desc: 'Detects low volatility windows for Accumulator entries' },
            { icon: Flame, title: 'Trend Exhaustion', desc: 'Identifies when a trend is losing momentum' },
            { icon: Clock, title: 'Time-Sensitive Signals', desc: 'Pattern signals are time-critical — your agent acts within seconds' },
            { icon: Sparkles, title: 'Backtest Module', desc: 'Test patterns against historical tick data before deploying' },
        ],
        stats: [
            { label: 'Regime labels', value: '3' },
            { label: 'Backtest', value: 'Planned' },
            { label: 'Phase 1', value: 'Live' },
        ],
    },
    partner: {
        tagline: 'Partner Strategy Overrides',
        description:
            'Phase 1 (implemented): loads an active competition from the DerivArena Go API — `contract_types`, partner display fields, and optional `partner_rules` (max stake cap enforced on demo trade POST; other limits surfaced for agents / UI).',
        features: [
            { icon: Globe, title: 'Contract Rules', desc: 'Restrict agents to specific contract types (ACCU, MULTUP, CALL/PUT)' },
            { icon: TrendingUp, title: 'Risk Limits', desc: 'Set max stake, max loss, or drawdown limits per agent' },
            { icon: Sparkles, title: 'Bias Injection', desc: 'Partners can inject market bias signals for agents to weight' },
            { icon: BarChart3, title: 'Leaderboard Weights', desc: 'Partner can weight signals from specific data sources higher' },
        ],
        stats: [
            { label: 'Allowlist', value: 'Live' },
            { label: 'Stake cap', value: 'Live' },
            { label: 'DD / day caps', value: 'Planned' },
        ],
    },
};

type CommandFeedsSnapshot = ReturnType<typeof useArenaCommandFeeds>;

function formatDataSourceWeights(pr?: PartnerRules): string {
    const w = pr?.data_source_weights;
    if (!w || typeof w !== 'object') return '—';
    const parts = Object.entries(w).map(([k, v]) => `${k}=${v}`);
    return parts.length ? parts.join(' · ') : '—';
}

function liveStatsForFeed(feedId: string, cf: CommandFeedsSnapshot): { label: string; value: string }[] {
    switch (feedId) {
        case 'deriv_ticks':
            if (!cf.enabledFeeds.deriv_ticks) {
                return [
                    { label: 'Feed', value: 'Off' },
                    { label: 'Symbol', value: cf.selectedMarket },
                    { label: 'Quote', value: '—' },
                ];
            }
            return [
                { label: 'Symbol', value: cf.selectedMarket },
                { label: 'Last quote', value: cf.deriv.quote != null ? cf.deriv.quote.toFixed(5) : '—' },
                { label: 'WebSocket', value: cf.deriv.status },
            ];
        case 'pattern':
            if (!cf.enabledFeeds.pattern) {
                return [{ label: 'Feed', value: 'Off' }, { label: 'Returns', value: '—' }, { label: 'Regime', value: '—' }];
            }
            return [
                { label: 'Returns', value: cf.pattern ? String(cf.pattern.tickCount) : '0' },
                { label: 'Regime', value: cf.pattern?.regime ?? '—' },
                { label: 'Rolling σ', value: cf.pattern?.sigmaPerTick != null ? cf.pattern.sigmaPerTick.toExponential(2) : '—' },
            ];
        case 'partner': {
            if (!cf.enabledFeeds.partner) {
                return [{ label: 'Feed', value: 'Off' }, { label: 'Max stake', value: '—' }, { label: 'Weights', value: '—' }];
            }
            if (cf.partner.loading) {
                return [{ label: 'Status', value: 'Loading…' }, { label: 'Max stake', value: '—' }, { label: 'Weights', value: '—' }];
            }
            if (cf.partner.error) return [{ label: 'API', value: 'Error' }, { label: 'Max stake', value: '—' }, { label: 'Weights', value: '—' }];
            if (!cf.partner.competition) return [{ label: 'Active', value: 'None' }, { label: 'Max stake', value: '—' }, { label: 'Weights', value: '—' }];
            const pr = cf.partner.competition.partner_rules;
            const wStr = formatDataSourceWeights(pr);
            const weightsCell = wStr === '—' ? '—' : (wStr.length > 28 ? `${wStr.slice(0, 28)}…` : wStr);
            return [
                { label: 'Partner', value: (cf.partner.competition.partner_name || cf.partner.competition.partner_id || '—').slice(0, 14) },
                { label: 'Max stake', value: pr?.max_stake_per_contract ?? '—' },
                { label: 'Weights', value: weightsCell },
            ];
        }
        case 'sentiment': {
            if (!cf.enabledFeeds.sentiment) {
                return [{ label: 'Feed', value: 'Off' }, { label: 'Policy score', value: '—' }, { label: 'Tick stress σ', value: '—' }];
            }
            const s = cf.sentiment;
            return [
                { label: 'Policy score', value: s ? s.policyScore.toFixed(2) : '—' },
                { label: 'Tick stress σ', value: s?.tickStressSigma != null ? s.tickStressSigma.toExponential(2) : '—' },
                { label: 'Channel', value: 'Notes + ticks' },
            ];
        }
        default:
            return [];
    }
}

function feedConnectionFoot(feedId: string, cf: CommandFeedsSnapshot): { ok: boolean; text: string } {
    const on = cf.enabledFeeds[feedId as keyof typeof cf.enabledFeeds];
    if (!on) return { ok: false, text: 'Feed disabled in Agent Configuration → Data Feeds.' };
    switch (feedId) {
        case 'deriv_ticks':
            if (cf.deriv.status === 'open') return { ok: true, text: 'Live ticks from Deriv public WebSocket.' };
            if (cf.deriv.status === 'error') return { ok: false, text: cf.deriv.detail ? `WS error: ${cf.deriv.detail}` : 'WebSocket error.' };
            if (cf.deriv.status === 'connecting') return { ok: false, text: 'Connecting to Deriv…' };
            return { ok: false, text: `WebSocket ${cf.deriv.status}.` };
        case 'pattern':
            if (!cf.enabledFeeds.deriv_ticks) return { ok: false, text: 'Enable Deriv ticks to compute patterns from returns.' };
            if ((cf.pattern?.tickCount ?? 0) < 5) return { ok: false, text: 'Collecting returns for volatility / regime…' };
            return { ok: true, text: cf.pattern?.headline ?? 'Patterns from live returns.' };
        case 'partner': {
            if (cf.partner.loading) return { ok: false, text: 'Loading active competitions…' };
            if (cf.partner.error) return { ok: false, text: cf.partner.error };
            if (!cf.partner.competition) return { ok: false, text: 'No active competition — create one or wait for host.' };
            const c = cf.partner.competition;
            const pr = c.partner_rules;
            const allow = (c.contract_types || []).join(', ');
            let tail = '';
            if (pr?.max_drawdown_percent) tail += ` Max DD ${pr.max_drawdown_percent}%.`;
            if (pr?.max_loss_per_day) tail += ` Max loss/day ${pr.max_loss_per_day}.`;
            if (pr?.market_bias) tail += ` Bias ${pr.market_bias}.`;
            const w = formatDataSourceWeights(pr);
            if (w !== '—') tail += ` Weights: ${w}.`;
            return {
                ok: true,
                text: `“${c.name}” — contracts: ${allow || '—'}.${tail}`,
            };
        }
        case 'sentiment':
            return { ok: true, text: cf.sentiment?.hint ?? 'Sentiment channel.' };
        default:
            return { ok: false, text: 'Unknown feed.' };
    }
}

function feedStatusDotClass(feedId: string, cf: CommandFeedsSnapshot): string {
    const on = cf.enabledFeeds[feedId as keyof typeof cf.enabledFeeds];
    if (!on) return 'bg-white/25';
    switch (feedId) {
        case 'deriv_ticks':
            if (cf.deriv.status === 'open') return 'bg-emerald-400';
            if (cf.deriv.status === 'error') return 'bg-red-400';
            return 'bg-amber-400';
        case 'pattern':
            return (cf.pattern?.tickCount ?? 0) >= 8 ? 'bg-emerald-400' : 'bg-amber-400';
        case 'partner':
            if (cf.partner.loading) return 'bg-amber-400';
            return cf.partner.competition ? 'bg-emerald-400' : 'bg-white/30';
        case 'sentiment':
            return 'bg-emerald-400';
        default:
            return 'bg-white/25';
    }
}

const AGENT_STATUS: Record<string, { label: string; color: string; dot: string }> = {
    TRAINING: { label: 'Training', color: 'text-yellow-400', dot: 'bg-yellow-400' },
    ACTIVE: { label: 'Active', color: 'text-emerald-400', dot: 'bg-emerald-400' },
    PAUSED: { label: 'Paused', color: 'rgba(255,255,255,0.35)', dot: 'bg-white/30' },
};

// ── Pulse animation engine ──────────────────────────────────────

interface Pulse {
    id: string;
    feedIndex: number;
    startTime: number;
}

function pulsesShallowEqual(a: Pulse[], b: Pulse[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i]?.id !== b[i]?.id) return false;
    }
    return true;
}

/** When disabled or feedCount is 0, no spawns and no per-frame state updates (avoids runaway re-renders). */
function usePulseEngine(enabled: boolean, feedCount: number, duration: number, interval: number) {
    const [pulses, setPulses] = useState<Pulse[]>([]);

    useEffect(() => {
        if (!enabled || feedCount <= 0) {
            setPulses([]);
            return;
        }

        const timeouts: ReturnType<typeof setTimeout>[] = [];

        const spawn = (i: number) => {
            setPulses(prev => [
                ...prev,
                { id: `${i}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, feedIndex: i, startTime: Date.now() },
            ]);
            timeouts.push(setTimeout(() => spawn(i), interval * 1000 * (0.7 + Math.random() * 0.6)));
        };

        for (let i = 0; i < feedCount; i++) {
            timeouts.push(setTimeout(() => spawn(i), Math.random() * interval * 1000));
        }

        return () => {
            timeouts.forEach(clearTimeout);
        };
    }, [enabled, feedCount, interval]);

    // Prune expired — only commit when the pulse list actually changes (prevents ~60 React commits/sec).
    useEffect(() => {
        if (!enabled || feedCount <= 0) {
            return;
        }

        let raf: number;
        const durationMs = duration * 1000;
        const tick = () => {
            const now = Date.now();
            setPulses(prev => {
                const next = prev.filter(p => (now - p.startTime) / durationMs < 1);
                return pulsesShallowEqual(prev, next) ? prev : next;
            });
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [enabled, feedCount, duration]);

    return pulses;
}

// ── SVG pulse layer ─────────────────────────────────────────────

function PulseLayer({
    feedPositions,
    agentPos,
    pulses,
    duration,
    width,
    height,
}: {
    feedPositions: { x: number; y: number }[];
    agentPos: { x: number; y: number };
    pulses: Pulse[];
    duration: number;
    width: number;
    height: number;
}) {
    const pathCacheRef = useRef<Map<number, SVGPathElement>>(new Map());
    const [segments, setSegments] = useState<{ id: string; d: string; opacity: number; color: string }[]>([]);

    useEffect(() => {
        pathCacheRef.current.clear();
    }, [feedPositions, agentPos]);

    useEffect(() => {
        if (pulses.length === 0) {
            setSegments([]);
            return;
        }

        let raf: number;
        const durationMs = duration * 1000;
        let lastSig = '';

        const calc = () => {
            const now = Date.now();
            const segs: typeof segments = [];

            for (const pulse of pulses) {
                const from = feedPositions[pulse.feedIndex];
                if (!from) continue;

                let path = pathCacheRef.current.get(pulse.feedIndex);
                if (!path) {
                    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const dx = agentPos.x - from.x;
                    const dy = agentPos.y - from.y;
                    path.setAttribute('d', `M ${from.x} ${from.y} C ${from.x + dx * 0.4} ${from.y}, ${agentPos.x} ${agentPos.y - dy * 0.4}, ${agentPos.x} ${agentPos.y}`);
                    pathCacheRef.current.set(pulse.feedIndex, path);
                }

                const progress = Math.min((now - pulse.startTime) / durationMs, 1);
                if (progress <= 0 || progress >= 1) continue;

                const length = path.getTotalLength();
                const headPos = progress;
                const tailPos = Math.max(0, progress - 0.3);
                const pts: { x: number; y: number }[] = [];
                for (let i = 0; i <= 8; i++) {
                    const pt = path.getPointAtLength(length * (tailPos + (headPos - tailPos) * (i / 8)));
                    pts.push({ x: pt.x, y: pt.y });
                }
                if (pts.length < 2) continue;

                const opacity = Math.min(1, progress / 0.15) * Math.min(1, (1 - progress) / 0.15);
                segs.push({
                    id: pulse.id,
                    d: `M ${pts[0].x} ${pts[0].y}` + pts.slice(1).map(p => ` L ${p.x} ${p.y}`).join(''),
                    opacity,
                    color: FEEDS[pulse.feedIndex]?.color ?? '#E8B45E',
                });
            }

            const sig = segs.map(s => `${s.id}:${s.d}:${s.opacity.toFixed(3)}`).join('|');
            if (sig !== lastSig) {
                lastSig = sig;
                setSegments(segs);
            }
            raf = requestAnimationFrame(calc);
        };
        raf = requestAnimationFrame(calc);
        return () => cancelAnimationFrame(raf);
    }, [pulses, feedPositions, agentPos, duration]);

    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            <defs>
                <filter id="pulseGlow2" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Static connection lines */}
            {feedPositions.map((from, i) => {
                const dx = agentPos.x - from.x;
                const dy = agentPos.y - from.y;
                const d = `M ${from.x} ${from.y} C ${from.x + dx * 0.4} ${from.y}, ${agentPos.x} ${agentPos.y - dy * 0.4}, ${agentPos.x} ${agentPos.y}`;
                return (
                    <path key={`line-${i}`} d={d} fill="none" stroke={FEEDS[i]?.color ?? '#333'} strokeWidth={1.5} opacity={0.12} />
                );
            })}

            {/* Animated pulses */}
            {segments.map(seg => (
                <g key={seg.id}>
                    <path d={seg.d} fill="none" stroke={seg.color} strokeWidth={4} strokeLinecap="round" opacity={seg.opacity * 0.3} filter="url(#pulseGlow2)" />
                    <path d={seg.d} fill="none" stroke={seg.color} strokeWidth={1.5} strokeLinecap="round" opacity={seg.opacity} />
                </g>
            ))}
        </svg>
    );
}

// ── Main component ──────────────────────────────────────────────

type DetailTab = 'tasks' | 'positions' | 'chats';

const DETAIL_TABS: { id: DetailTab; label: string; icon: typeof ListChecks }[] = [
    { id: 'tasks', label: 'Tasks', icon: ListChecks },
    { id: 'positions', label: 'Positions', icon: TrendingUp },
    { id: 'chats', label: 'Chats', icon: MessageSquare },
];

export function AgentDataFlow({ animatePipeline = true }: { animatePipeline?: boolean }) {
    const { agent } = useAuthStore();
    const commandFeeds = useArenaCommandFeeds();
    const { user, authenticated, login } = usePrivy();
    const rawAvatarUrl = agent?.avatarUrl || user?.twitter?.profilePictureUrl || null;
    const avatarUrl = rawAvatarUrl?.replace('_normal.', '_400x400.') ?? null;
    const containerRef = useRef<HTMLDivElement>(null);
    const [dims, setDims] = useState({ w: 800, h: 500 });
    const statusInfo = AGENT_STATUS[agent?.status ?? 'TRAINING'] ?? AGENT_STATUS.TRAINING;

    const [expanded, setExpanded] = useState(false);
    const [activeTab, setActiveTab] = useState<DetailTab>('tasks');
    const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
    const isMobile = useIsMobile();
    const [tasks, setTasks] = useState<AgentTaskType[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [chats, setChats] = useState<AgentConversationSummary[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const fetchedRef = useRef(false);

    useEffect(() => {
        const update = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setDims({ w: width, h: height });
            }
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Fetch detail data when expanded for the first time
    useEffect(() => {
        if (!expanded || !agent || fetchedRef.current) return;
        fetchedRef.current = true;
        setDetailLoading(true);

        Promise.allSettled([
            getArenaTasks().catch(() => []),
            getAgentPositions(agent.id).catch(() => []),
            getAgentConversations(agent.id).catch(() => []),
        ]).then(([tasksRes, posRes, chatsRes]) => {
            if (tasksRes.status === 'fulfilled') setTasks(tasksRes.value as AgentTaskType[]);
            if (posRes.status === 'fulfilled') setPositions(posRes.value as Position[]);
            if (chatsRes.status === 'fulfilled') setChats(chatsRes.value as AgentConversationSummary[]);
            setDetailLoading(false);
        });
    }, [expanded, agent]);

    const pulses = usePulseEngine(animatePipeline, FEEDS.length, 3.5, 5);

    const feedPositions = useMemo(() => {
        // 4 corners around the center agent
        const mx = dims.w * 0.14; // horizontal margin
        const my = dims.h * 0.22; // vertical margin
        return [
            { x: mx, y: my },                        // top-left
            { x: dims.w - mx, y: my },                // top-right
            { x: mx, y: dims.h - my },                // bottom-left
            { x: dims.w - mx, y: dims.h - my },       // bottom-right
        ];
    }, [dims.w, dims.h]);

    const agentPos = useMemo(() => ({ x: dims.w * 0.5, y: dims.h * 0.5 }), [dims]);

    const xpPercent = agent ? Math.min(100, Math.round((agent.xp / Math.max(1, agent.xpForNextLevel)) * 100)) : 0;
    const hasAgent = !!agent;

    const activeTasks = useMemo(() => tasks.filter(t => t.status === 'OPEN' || t.status === 'CLAIMED'), [tasks]);
    const openPositions = useMemo(() => positions.filter(p => !p.closedAt), [positions]);

    // ── Mobile layout ──────────────────────────────────────────
    if (isMobile) {
        return (
            <div className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_32px_rgba(0,0,0,0.3)]">
                {/* DNA flow animation styles */}
                <style>{`
                    @keyframes dnaFlow {
                        0% { stroke-dashoffset: 80; }
                        100% { stroke-dashoffset: 0; }
                    }
                    @keyframes dnaFlowReverse {
                        0% { stroke-dashoffset: -80; }
                        100% { stroke-dashoffset: 0; }
                    }
                    .dna-pulse { animation: dnaFlow 2.5s ease-in-out infinite; }
                    .dna-pulse-reverse { animation: dnaFlowReverse 2.5s ease-in-out infinite; }
                `}</style>

                {/* Feed flow — centered cards with DNA helix connectors */}
                <div className="relative px-4 pt-5 pb-0">
                    {FEEDS.map((feed, i) => {
                        const Icon = feed.icon;
                        const c = `${feed.color}40`;
                        return (
                            <div key={feed.id}>
                                {/* DNA helix connector from previous card */}
                                {i > 0 && (
                                    <div className="relative h-14">
                                        <svg
                                            className="absolute inset-0 w-full h-full"
                                            viewBox="0 0 100 56"
                                            preserveAspectRatio="none"
                                            fill="none"
                                        >
                                            {/* Static strands */}
                                            <path
                                                d="M 36 0 C 36 22, 64 34, 64 56"
                                                stroke={FEEDS[i - 1].color}
                                                strokeWidth="1.5"
                                                opacity="0.3"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                            <path
                                                d="M 64 0 C 64 22, 36 34, 36 56"
                                                stroke={feed.color}
                                                strokeWidth="1.5"
                                                opacity="0.3"
                                                vectorEffect="non-scaling-stroke"
                                            />
                                            {/* Animated flowing pulses */}
                                            <path
                                                d="M 36 0 C 36 22, 64 34, 64 56"
                                                stroke={FEEDS[i - 1].color}
                                                strokeWidth="2"
                                                opacity="0.6"
                                                vectorEffect="non-scaling-stroke"
                                                strokeDasharray="12 68"
                                                className="dna-pulse"
                                                style={{ animationDelay: `${i * 0.4}s` }}
                                            />
                                            <path
                                                d="M 64 0 C 64 22, 36 34, 36 56"
                                                stroke={feed.color}
                                                strokeWidth="2"
                                                opacity="0.6"
                                                vectorEffect="non-scaling-stroke"
                                                strokeDasharray="12 68"
                                                className="dna-pulse-reverse"
                                                style={{ animationDelay: `${i * 0.4 + 1.2}s` }}
                                            />
                                        </svg>
                                        {/* Center crossing node */}
                                        <div
                                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
                                            style={{
                                                background: `linear-gradient(135deg, ${FEEDS[i - 1].color}, ${feed.color})`,
                                                opacity: 0.35,
                                            }}
                                        />
                                    </div>
                                )}
                                {/* Feed card */}
                                <div className="flex justify-center">
                                    <button
                                        onClick={() => setSelectedFeed(feed.id)}
                                        className="relative bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] px-4 py-2.5 cursor-pointer active:bg-white/[0.1] transition-colors w-[72%]"
                                    >
                                        <div className={`absolute top-2 right-3 w-1.5 h-1.5 rounded-full ${feedStatusDotClass(feed.id, commandFeeds)}`} aria-hidden />
                                        <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l" style={{ borderColor: c }} />
                                        <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r" style={{ borderColor: c }} />
                                        <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l" style={{ borderColor: c }} />
                                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r" style={{ borderColor: c }} />

                                        <div className="flex items-center gap-3">
                                            <Icon className="w-6 h-6 flex-shrink-0" style={{ color: feed.color }} />
                                            <div className="min-w-0 text-left">
                                                <div className="text-sm font-bold text-white leading-tight">{feed.label}</div>
                                                <div className="text-[10px] text-white/35">{feed.desc}</div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        );
                    })}

                    {/* Final convergence — both strands merge to center toward the agent */}
                    <div className="relative h-10">
                        <svg
                            className="absolute inset-0 w-full h-full"
                            viewBox="0 0 100 40"
                            preserveAspectRatio="none"
                            fill="none"
                        >
                            <path
                                d="M 36 0 C 36 16, 50 28, 50 40"
                                stroke={FEEDS[FEEDS.length - 1].color}
                                strokeWidth="1.5"
                                opacity="0.25"
                                vectorEffect="non-scaling-stroke"
                            />
                            <path
                                d="M 64 0 C 64 16, 50 28, 50 40"
                                stroke={FEEDS[FEEDS.length - 1].color}
                                strokeWidth="1.5"
                                opacity="0.25"
                                vectorEffect="non-scaling-stroke"
                            />
                            {/* Animated convergence pulses */}
                            <path
                                d="M 36 0 C 36 16, 50 28, 50 40"
                                stroke={FEEDS[FEEDS.length - 1].color}
                                strokeWidth="2"
                                opacity="0.5"
                                vectorEffect="non-scaling-stroke"
                                strokeDasharray="10 50"
                                className="dna-pulse"
                                style={{ animationDelay: '1.6s' }}
                            />
                            <path
                                d="M 64 0 C 64 16, 50 28, 50 40"
                                stroke={FEEDS[FEEDS.length - 1].color}
                                strokeWidth="2"
                                opacity="0.5"
                                vectorEffect="non-scaling-stroke"
                                strokeDasharray="10 50"
                                className="dna-pulse-reverse"
                                style={{ animationDelay: '2.8s' }}
                            />
                        </svg>
                    </div>
                </div>

                {/* Agent card */}
                <div className="mx-4 mb-4 mt-2 bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] relative z-20 overflow-visible">
                    {hasAgent && (
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="w-full px-4 py-4 flex items-center gap-3.5 cursor-pointer active:bg-white/[0.04] transition-colors"
                        >
                            <div className="w-11 h-11 rounded-full bg-[rgba(232,180,94,0.08)] border-2 border-[rgba(232,180,94,0.30)] flex items-center justify-center overflow-hidden flex-shrink-0">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt={agent.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <span className="text-[#E8B45E] font-bold text-lg">
                                        {agent.name?.charAt(0)?.toUpperCase() ?? '?'}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-white truncate">{agent.name}</span>
                                    <span className="bg-[rgba(232,180,94,0.12)] border border-[rgba(232,180,94,0.25)] px-1.5 py-0.5 text-[10px] font-bold text-[#E8B45E]">
                                        Lv.{agent.level}
                                    </span>
                                    <div className={`flex items-center gap-1 text-[10px] font-semibold ${statusInfo.color}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} animate-pulse`} />
                                        {statusInfo.label}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div className="flex-1 h-1.5 bg-white/[0.06] overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-accent-primary/80 to-accent-primary transition-all duration-500"
                                            style={{ width: `${xpPercent}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-white/35 font-mono whitespace-nowrap">
                                        {agent.xp}/{agent.xpForNextLevel}
                                    </span>
                                </div>
                            </div>
                            <ChevronDown
                                className="w-4 h-4 text-white/35 flex-shrink-0 transition-transform duration-300"
                                style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            />
                        </button>
                    )}
                    {hasAgent && (
                        <div
                            className="grid transition-[grid-template-rows] duration-300 ease-out"
                            style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                        >
                            <div className="overflow-hidden">
                                <div className="bg-white/[0.06] backdrop-blur-xl border-t border-white/[0.06]">
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-bold text-white">
                                            {DETAIL_TABS.find(t => t.id === activeTab)?.label}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {DETAIL_TABS.map((tab) => {
                                                const Icon = tab.icon;
                                                const isActive = activeTab === tab.id;
                                                const count = tab.id === 'tasks' ? activeTasks.length
                                                    : tab.id === 'positions' ? openPositions.length
                                                    : chats.length;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setActiveTab(tab.id)}
                                                        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold transition-all cursor-pointer ${
                                                            isActive
                                                                ? 'text-[#E8B45E] bg-[rgba(232,180,94,0.08)] border border-[rgba(232,180,94,0.20)]'
                                                                : 'text-white/35 hover:text-white/55 hover:bg-white/[0.03] border border-transparent'
                                                        }`}
                                                    >
                                                        <Icon className="w-3.5 h-3.5" />
                                                        {count > 0 && (
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                                                isActive ? 'bg-[rgba(232,180,94,0.16)] text-[#E8B45E]' : 'bg-white/[0.06] text-white/35'
                                                            }`}>
                                                                {count}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="px-4 pb-4 min-h-[120px] max-h-[280px] overflow-y-auto">
                                        {detailLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="w-5 h-5 border-2 border-[rgba(232,180,94,0.30)] border-t-accent-primary rounded-full animate-spin" />
                                            </div>
                                        ) : activeTab === 'tasks' ? (
                                            <TasksSection tasks={activeTasks} />
                                        ) : activeTab === 'positions' ? (
                                            <PositionsSection positions={openPositions} />
                                        ) : (
                                            <ChatsSection chats={chats} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {!hasAgent && (
                        <button
                            onClick={() => { if (!authenticated) login(); }}
                            className="w-full relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform duration-150"
                        >
                            {/* Animated glow background */}
                            <div className="absolute inset-0 bg-gradient-to-b from-accent-primary/[0.08] via-accent-primary/[0.03] to-transparent" />
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-[1px] bg-gradient-to-r from-transparent via-accent-primary/60 to-transparent" />

                            <div className="relative px-4 py-5">
                                {/* Title row — full width */}
                                <h3 className="text-base font-bold text-white text-center w-full">
                                    {authenticated ? 'Deploy Your Agent' : 'Deploy Your Agent'}
                                </h3>
                                <p className="text-[11px] text-white/35 text-center mt-1 leading-relaxed">
                                    {authenticated
                                        ? 'Feeds follow Agent Configuration (local). Open any node for live connection status.'
                                        : 'Command Center previews your agent pipeline. Sign in to bind identity and save config.'}
                                </p>

                                {/* CTA button */}
                                <div className="mt-4">
                                    <div className="relative">
                                        <div className="absolute -inset-1 bg-[rgba(232,180,94,0.16)] blur-lg" />
                                        <div className="relative w-full py-3 bg-[rgba(232,180,94,0.12)] border border-[rgba(232,180,94,0.40)] flex items-center justify-center">
                                            <span className="text-base font-bold text-[#E8B45E] tracking-wide">
                                                {authenticated ? 'Create' : 'Create'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom accent line */}
                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-[1px] bg-gradient-to-r from-transparent via-accent-primary/40 to-transparent" />
                        </button>
                    )}
                </div>

                <FeedDetailSheet
                    feedId={selectedFeed}
                    open={!!selectedFeed}
                    onClose={() => setSelectedFeed(null)}
                    isMobile={isMobile}
                    commandFeeds={commandFeeds}
                />
            </div>
        );
    }

    // ── Desktop layout ──────────────────────────────────────────
    return (
        <div className="bg-[#0a0a12]/60 backdrop-blur-xl border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_32px_rgba(0,0,0,0.5)]">
            <div ref={containerRef} className="relative h-[180px]">

                {/* Pulse animation layer (skip when static — saves GPU/CPU on lab pages) */}
                {animatePipeline && (
                    <PulseLayer
                        feedPositions={feedPositions}
                        agentPos={agentPos}
                        pulses={pulses}
                        duration={3.5}
                        width={dims.w}
                        height={dims.h}
                    />
                )}

                {/* ── Feed nodes (2x2 grid on left) ── */}
                {FEEDS.map((feed, i) => {
                    const Icon = feed.icon;
                    const pos = feedPositions[i];
                    const c = `${feed.color}40`;
                    return (
                        <div
                            key={feed.id}
                            className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                            style={{ left: pos?.x, top: pos?.y }}
                        >
                            <div
                                className="relative bg-[#0e0e18]/90 backdrop-blur-md px-3 py-2 cursor-pointer group hover:bg-[#0e0e18] transition-colors duration-200"
                                onClick={() => setSelectedFeed(feed.id)}
                            >
                                <div className={`absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full ${feedStatusDotClass(feed.id, commandFeeds)}`} aria-hidden />
                                {/* Corner brackets */}
                                <span className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: c }} />
                                <span className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: c }} />
                                <span className="absolute bottom-0 left-0 w-2 h-2 border-b border-l" style={{ borderColor: c }} />
                                <span className="absolute bottom-0 right-0 w-2 h-2 border-b border-r" style={{ borderColor: c }} />

                                <div className="flex items-center gap-2">
                                    <Icon className="w-4 h-4 flex-shrink-0" style={{ color: feed.color }} />
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white whitespace-nowrap leading-tight">{feed.label}</span>
                                        <span className="text-[9px] text-white/35 whitespace-nowrap">{feed.desc}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* ── Agent card (right side) ── */}
                <div
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                    style={{ left: agentPos.x, top: agentPos.y }}
                >
                    {hasAgent ? (
                        <div>
                        <button
                            onClick={() => setExpanded(!expanded)}
                            className="relative cursor-pointer group"
                        >
                            {/* Glow */}
                            <div className="absolute -inset-3 bg-[rgba(232,180,94,0.06)] blur-xl pointer-events-none group-hover:bg-[rgba(232,180,94,0.08)] transition-all duration-300" />

                            <div className="relative bg-[#0e0e18]/95 backdrop-blur-xl px-4 py-2.5 flex items-center gap-3 shadow-[0_0_40px_rgba(232,180,94,0.06)] group-hover:bg-[#0e0e18] transition-colors duration-200">
                                {/* Corner brackets */}
                                <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-[rgba(232,180,94,0.40)] group-hover:border-accent-primary/60 transition-colors" />
                                <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-[rgba(232,180,94,0.40)] group-hover:border-accent-primary/60 transition-colors" />
                                <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-[rgba(232,180,94,0.40)] group-hover:border-accent-primary/60 transition-colors" />
                                <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-[rgba(232,180,94,0.40)] group-hover:border-accent-primary/60 transition-colors" />

                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-full bg-[rgba(232,180,94,0.08)] border-2 border-[rgba(232,180,94,0.30)] flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={agent.name} className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <span className="text-[#E8B45E] font-bold text-base">
                                            {agent.name?.charAt(0)?.toUpperCase() ?? '?'}
                                        </span>
                                    )}
                                </div>

                                {/* Info */}
                                <div className="flex flex-col gap-1 min-w-0 text-left">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-white truncate">{agent.name}</h3>
                                        <span className="bg-[rgba(232,180,94,0.12)] border border-[rgba(232,180,94,0.25)] px-1.5 py-0.5 text-[10px] font-bold text-[#E8B45E] whitespace-nowrap">
                                            Lv.{agent.level}
                                        </span>
                                        <div className={`flex items-center gap-1 text-[9px] font-semibold ${statusInfo.color}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot} animate-pulse`} />
                                            {statusInfo.label}
                                        </div>
                                    </div>

                                    {/* XP bar */}
                                    <div className="flex items-center gap-2">
                                        <div className="w-32 h-1.5 bg-white/[0.06] overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-accent-primary/80 to-accent-primary transition-all duration-500"
                                                style={{ width: `${xpPercent}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-white/35 font-mono whitespace-nowrap">
                                            {agent.xp}/{agent.xpForNextLevel}
                                        </span>
                                    </div>
                                </div>

                                {/* Expand chevron */}
                                <div className="pl-2 border-l border-white/[0.06] ml-1 flex-shrink-0">
                                    <ChevronDown
                                        className="w-4 h-4 text-white/35 transition-transform duration-300 ease-out"
                                        style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                                    />
                                </div>
                            </div>
                        </button>
                        <div
                            className="grid transition-[grid-template-rows] duration-300 ease-out"
                            style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
                        >
                            <div className="overflow-hidden">
                                <div className="bg-[#0e0e18]/95 backdrop-blur-xl border-t border-white/[0.06]">
                                    <div className="flex items-center justify-between px-4 py-2.5">
                                        <span className="text-xs font-bold text-white">
                                            {DETAIL_TABS.find(t => t.id === activeTab)?.label}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {DETAIL_TABS.map((tab) => {
                                                const Icon = tab.icon;
                                                const isActive = activeTab === tab.id;
                                                const count = tab.id === 'tasks' ? activeTasks.length
                                                    : tab.id === 'positions' ? openPositions.length
                                                    : chats.length;
                                                return (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setActiveTab(tab.id)}
                                                        className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-semibold transition-all cursor-pointer ${
                                                            isActive
                                                                ? 'text-[#E8B45E] bg-[rgba(232,180,94,0.08)] border border-[rgba(232,180,94,0.20)]'
                                                                : 'text-white/35 hover:text-white/55 hover:bg-white/[0.03] border border-transparent'
                                                        }`}
                                                    >
                                                        <Icon className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">{tab.label}</span>
                                                        {count > 0 && (
                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                                                isActive ? 'bg-[rgba(232,180,94,0.16)] text-[#E8B45E]' : 'bg-white/[0.06] text-white/35'
                                                            }`}>
                                                                {count}
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="px-4 pb-4 min-h-[120px] max-h-[280px] overflow-y-auto">
                                        {detailLoading ? (
                                            <div className="flex items-center justify-center py-8">
                                                <div className="w-5 h-5 border-2 border-[rgba(232,180,94,0.30)] border-t-accent-primary rounded-full animate-spin" />
                                            </div>
                                        ) : activeTab === 'tasks' ? (
                                            <TasksSection tasks={activeTasks} />
                                        ) : activeTab === 'positions' ? (
                                            <PositionsSection positions={openPositions} />
                                        ) : (
                                            <ChatsSection chats={chats} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                    ) : (
                        /* No agent — CTA */
                        <div className="relative group">
                            <div className="absolute -inset-4 bg-[rgba(232,180,94,0.06)] blur-2xl pointer-events-none group-hover:bg-[rgba(232,180,94,0.08)] transition-all duration-500" />
                            <button
                                onClick={() => { if (!authenticated) login(); }}
                                className="relative bg-[#0e0e18]/95 backdrop-blur-xl px-6 py-3 max-w-sm cursor-pointer hover:bg-[#0e0e18] transition-all duration-300"
                            >
                                {/* Corner brackets */}
                                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[rgba(232,180,94,0.40)] group-hover:border-accent-primary/70 transition-colors duration-300" />
                                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[rgba(232,180,94,0.40)] group-hover:border-accent-primary/70 transition-colors duration-300" />
                                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[rgba(232,180,94,0.40)] group-hover:border-accent-primary/70 transition-colors duration-300" />
                                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[rgba(232,180,94,0.40)] group-hover:border-accent-primary/70 transition-colors duration-300" />

                                {/* Inline: title + button side by side */}
                                <div className="flex items-center gap-4">
                                    <h3 className="text-sm font-bold text-white whitespace-nowrap">
                                        {authenticated ? 'Create Your Agent' : 'Deploy Your Agent'}
                                    </h3>
                                    <div className="flex items-center gap-1.5 px-4 py-2 bg-[rgba(232,180,94,0.08)] border border-[rgba(232,180,94,0.30)] group-hover:bg-[rgba(232,180,94,0.16)] group-hover:border-[rgba(232,180,94,0.50)] transition-all duration-300">
                                        <Zap className="w-3.5 h-3.5 text-[#E8B45E]" />
                                        <span className="text-xs font-bold text-[#E8B45E]">
                                            {authenticated ? 'Start' : 'Create'}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}
                </div>

            </div>


            {/* Feed Detail Sheet */}
            <FeedDetailSheet
                feedId={selectedFeed}
                open={!!selectedFeed}
                onClose={() => setSelectedFeed(null)}
                isMobile={isMobile}
                commandFeeds={commandFeeds}
            />
        </div>
    );
}

// ── Feed Detail Sheet ───────────────────────────────────────────

function FeedDetailSheet({
    feedId,
    open,
    onClose,
    isMobile,
    commandFeeds,
}: {
    feedId: string | null;
    open: boolean;
    onClose: () => void;
    isMobile: boolean;
    commandFeeds: CommandFeedsSnapshot;
}) {
    const feed = FEEDS.find(f => f.id === feedId);
    const details = feedId ? FEED_DETAILS[feedId] : null;
    if (!feed || !details) return null;

    const Icon = feed.icon;
    const stats = feedId ? liveStatsForFeed(feedId, commandFeeds) : [];
    const foot = feedId ? feedConnectionFoot(feedId, commandFeeds) : { ok: false, text: '' };

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <SheetContent side={isMobile ? 'bottom' : 'right'} className="overflow-y-auto">
                <SheetHeader className="text-left">
                    <div className="flex items-center gap-3 mb-1">
                        <div
                            className="w-10 h-10 flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${feed.color}15`, border: `1px solid ${feed.color}30` }}
                        >
                            <Icon className="w-5 h-5" style={{ color: feed.color }} />
                        </div>
                        <div>
                            <SheetTitle className="text-lg font-bold text-white">{feed.label}</SheetTitle>
                            <SheetDescription className="text-xs text-white/35 mt-0">{details.tagline}</SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                <div className="mt-5 space-y-6 px-1">
                    {/* Description */}
                    <p className="text-sm text-white/55 leading-relaxed">
                        {details.description}
                    </p>

                    {/* Live stats (wired to prefs + Deriv WS + Go API + paper policy) */}
                    <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Live status</h4>
                        <div className="grid grid-cols-3 gap-3">
                            {stats.map((stat) => (
                                <div key={stat.label} className="bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-center">
                                    <div className="text-base font-bold font-mono break-all" style={{ color: feed.color }}>{stat.value}</div>
                                    <div className="text-[10px] text-white/35 mt-0.5">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Roadmap / product stats (static targets — not telemetry) */}
                    <div>
                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">Product targets</h4>
                        <div className="grid grid-cols-3 gap-3">
                            {details.stats.map((stat) => (
                                <div key={stat.label} className="bg-white/[0.02] border border-white/[0.05] px-3 py-2.5 text-center opacity-80">
                                    <div className="text-sm font-bold font-mono text-white/50">{stat.value}</div>
                                    <div className="text-[10px] text-white/30 mt-0.5">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Features */}
                    <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">How it works</h4>
                        <div className="space-y-3">
                            {details.features.map((feature) => {
                                const FeatureIcon = feature.icon;
                                return (
                                    <div key={feature.title} className="flex gap-3">
                                        <div
                                            className="w-8 h-8 flex items-center justify-center flex-shrink-0 mt-0.5"
                                            style={{ backgroundColor: `${feed.color}10` }}
                                        >
                                            <FeatureIcon className="w-4 h-4" style={{ color: feed.color }} />
                                        </div>
                                        <div>
                                            <h5 className="text-sm font-semibold text-white">{feature.title}</h5>
                                            <p className="text-xs text-white/35 leading-relaxed mt-0.5">{feature.desc}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Connection truth line */}
                    <div className="flex items-start gap-2 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06]">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${foot.ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <span className="text-xs text-white/45 leading-relaxed">{foot.text}</span>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ── Detail section components ────────────────────────────────────

function TasksSection({ tasks }: { tasks: AgentTaskType[] }) {
    if (tasks.length === 0) {
        return (
            <div className="text-center py-6">
                <ListChecks className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/35">No active tasks</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {tasks.map((task) => (
                <div key={task.taskId} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'CLAIMED' ? 'bg-yellow-400' : 'bg-emerald-400'}`} />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-white/35 uppercase">{task.taskType}</span>
                            {task.tokenSymbol && (
                                <span className="text-[10px] text-[#E8B45E] font-mono">${task.tokenSymbol}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-[rgba(232,180,94,0.08)] border border-[rgba(232,180,94,0.20)] flex-shrink-0">
                        <Zap className="w-3 h-3 text-[#E8B45E]" />
                        <span className="text-[10px] font-bold text-[#E8B45E]">+{task.xpReward} XP</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PositionsSection({ positions }: { positions: Position[] }) {
    if (positions.length === 0) {
        return (
            <div className="text-center py-6">
                <TrendingUp className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/35">No open positions</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {positions.map((pos) => {
                const isProfit = pos.pnl >= 0;
                return (
                    <div key={pos.positionId} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                        <div className={`w-8 h-8 flex items-center justify-center flex-shrink-0 ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            {isProfit ? (
                                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                            ) : (
                                <ArrowDownRight className="w-4 h-4 text-red-400" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white">${pos.tokenSymbol}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-white/35 font-mono">
                                    Entry: ${pos.entryPrice.toFixed(6)}
                                </span>
                                <span className="text-[10px] text-white/35">→</span>
                                <span className="text-[10px] text-white/35 font-mono">
                                    Now: ${pos.currentPrice.toFixed(6)}
                                </span>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <p className={`text-xs font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                {isProfit ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                            </p>
                            <p className="text-[10px] text-white/35 font-mono">
                                ${pos.currentValue.toFixed(2)}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ChatsSection({ chats }: { chats: AgentConversationSummary[] }) {
    if (chats.length === 0) {
        return (
            <div className="text-center py-6">
                <MessageSquare className="w-6 h-6 text-white/10 mx-auto mb-2" />
                <p className="text-xs text-white/35">No conversations yet</p>
            </div>
        );
    }
    return (
        <div className="space-y-2">
            {chats.map((chat) => (
                <div key={chat.conversationId} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                    <div className="w-8 h-8 bg-[#818CF8]/10 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-4 h-4 text-[#818CF8]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{chat.topic}</p>
                        {chat.lastMessage && (
                            <p className="text-[10px] text-white/35 truncate mt-0.5">{chat.lastMessage}</p>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <div className="flex items-center gap-1">
                            <span className="text-[10px] text-white/35">{chat.agentMessageCount} msgs</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-white/35">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(chat.lastMessageAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
