'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sfx } from '@/lib/sounds';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  XCircle,
  Clock,
  Zap,
  User,
  Ghost,
  GitBranch,
} from 'lucide-react';
import { LiveChart } from '@/components/game/shared/LiveChart';
import { SymbolSelector } from '@/components/game/shared/SymbolSelector';
import { RankBadge } from '@/components/game/shared/RankBadge';
import { useTradeStore } from '@/lib/stores/trade-store';
import { useTiltStore } from '@/lib/stores/tilt-store';
import { formatCurrency } from '@/lib/utils/formatters';
import { uniqueId } from '@/lib/utils/unique-id';
import { TILT_ZONE_COLORS } from '@/lib/engines/tilt-detection';
import type { TradeDirection } from '@/lib/db/schema';
import {
  placeSimulatedTrade,
  sellSimulatedTradeEarly,
  hasActiveSimulation,
} from '@/lib/engines/trade-simulator';

interface Props {
  instanceId: string;
  userId: string;
  isLive: boolean;
  onScoreUpdate: (data: {
    score: number;
    pnl: number;
    trades_count: number;
    behavioral_score: number;
  }) => void;
}

type EvolutionKey = 'MIRROR' | 'PATTERN' | 'BEHAVIOR' | 'INVERSE';

const EMERALD = '#10b981';
const AY_ORANGE = '#F97316';
const AY_PURPLE = '#8B5CF6';

const MAX_DECOYS_PER_ROUND = 2;
const MAX_DECOYS_PER_SESSION = 10;

const DURATION_PRESETS = [
  { label: '1m', value: 1, unit: 'm' },
  { label: '5m', value: 5, unit: 'm' },
  { label: '15m', value: 15, unit: 'm' },
  { label: '1h', value: 60, unit: 'm' },
];

const EVOLUTION_META: Record<
  EvolutionKey,
  { label: string; short: string; accent: string; ring: string; bonus: number; blurb: string }
> = {
  MIRROR: {
    label: 'MIRROR',
    short: 'Copy',
    accent: '#38bdf8',
    ring: 'rgba(56,189,248,0.35)',
    bonus: 0,
    blurb: 'Clone mirrors every trade you open.',
  },
  PATTERN: {
    label: 'PATTERN',
    short: 'Detect',
    accent: AY_PURPLE,
    ring: 'rgba(139,92,246,0.35)',
    bonus: 10,
    blurb: 'Clone spots streaks — it counters when your last 3 match.',
  },
  BEHAVIOR: {
    label: 'BEHAVIOR',
    short: 'Tendency',
    accent: AY_ORANGE,
    ring: 'rgba(249,115,22,0.35)',
    bonus: 20,
    blurb: 'Clone flips against your directional bias every time.',
  },
  INVERSE: {
    label: 'INVERSE',
    short: 'Opposite',
    accent: '#f43f5e',
    ring: 'rgba(244,63,94,0.4)',
    bonus: 40,
    blurb: 'Full adversary — opposite side at 1.5× stake.',
  },
};

const STAGE_ORDER: EvolutionKey[] = ['MIRROR', 'PATTERN', 'BEHAVIOR', 'INVERSE'];

function evolutionKeyFromSessionTrades(completed: number): EvolutionKey {
  if (completed <= 5) return 'MIRROR';
  if (completed <= 15) return 'PATTERN';
  if (completed <= 30) return 'BEHAVIOR';
  return 'INVERSE';
}

interface PendingShadow {
  tradeId: string;
  ayDirection: TradeDirection;
  ayStake: number;
  stage: EvolutionKey;
}

interface ShadowTradeRow {
  id: string;
  asset: string;
  direction: TradeDirection;
  stake: number;
  pnl: number;
  stage: EvolutionKey;
  at: number;
  isDecoy?: boolean;
}

interface EquityPt {
  time: number;
  yourPnl: number;
  ayPnl: number;
}

function computeShadowPlan(
  completedSessionTrades: number,
  userDirection: TradeDirection,
  userStake: number,
  historyNewestFirst: { status: string; direction: TradeDirection }[]
): { ayDirection: TradeDirection; ayStake: number; stage: EvolutionKey } {
  const stage = evolutionKeyFromSessionTrades(completedSessionTrades);
  const prior = historyNewestFirst
    .filter((t) => t.status !== 'active')
    .slice(0, 3);
  const threeSameDir =
    prior.length === 3 &&
    prior[0].direction === prior[1].direction &&
    prior[1].direction === prior[2].direction;

  switch (stage) {
    case 'MIRROR':
      return { ayDirection: userDirection, ayStake: userStake, stage };
    case 'PATTERN':
      return {
        ayDirection: threeSameDir
          ? userDirection === 'CALL'
            ? 'PUT'
            : 'CALL'
          : userDirection,
        ayStake: userStake,
        stage,
      };
    case 'BEHAVIOR':
      return {
        ayDirection: userDirection === 'CALL' ? 'PUT' : 'CALL',
        ayStake: userStake,
        stage,
      };
    case 'INVERSE':
      return {
        ayDirection: userDirection === 'CALL' ? 'PUT' : 'CALL',
        ayStake: userStake * 1.5,
        stage,
      };
    default:
      return { ayDirection: userDirection, ayStake: userStake, stage: 'MIRROR' };
  }
}

function shadowPnlFromClosedTrade(
  closed: { direction: TradeDirection; stake: number; pnl?: number },
  shadow: PendingShadow
): number {
  const userPnl = closed.pnl ?? 0;
  const ratio = shadow.ayStake / closed.stake;
  if (shadow.ayDirection === closed.direction) {
    return userPnl * ratio;
  }
  return -userPnl * ratio;
}

function computeGlitchLevel(antiYouLead: number): 0 | 1 | 2 | 3 {
  if (antiYouLead < 10) return 0;
  if (antiYouLead < 25) return 1;
  if (antiYouLead < 50) return 2;
  return 3;
}

export default function AntiYouRenderer(props: Props) {
  const { instanceId, userId, isLive, onScoreUpdate } = props;

  const {
    selectedAsset,
    selectedDirection,
    selectedStake,
    selectedDuration,
    selectedDurationUnit,
    activePosition,
    sessionPnl,
    sessionTrades,
    sessionWins,
    tradeHistory,
    setSelectedDirection,
    setSelectedStake,
    setSelectedDuration,
  } = useTradeStore();

  const { score: tiltScore, zone: tiltZone } = useTiltStore();

  const [antiYouPnl, setAntiYouPnl] = useState(0);
  const [antiYouTrades, setAntiYouTrades] = useState(0);
  const [antiYouWins, setAntiYouWins] = useState(0);
  const [shadowRows, setShadowRows] = useState<ShadowTradeRow[]>([]);
  const [equityHistory, setEquityHistory] = useState<EquityPt[]>(() => [
    { time: Date.now(), yourPnl: 0, ayPnl: 0 },
  ]);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [stageFlash, setStageFlash] = useState<EvolutionKey | null>(null);

  const [decoyCount, setDecoyCount] = useState(0);
  const [decoysThisRound, setDecoysThisRound] = useState(0);
  const [antiYouConfidence, setAntiYouConfidence] = useState(50);
  const [successfulDecoys, setSuccessfulDecoys] = useState(0);
  const [tradesWonWhileGlitched, setTradesWonWhileGlitched] = useState(0);
  const [deglitchPlaying, setDeglitchPlaying] = useState(false);

  const decoyHistoryRef = useRef<{ status: string; direction: TradeDirection }[]>([]);
  const pendingShadowRef = useRef<PendingShadow | null>(null);
  const prevTradesRef = useRef(sessionTrades);
  const prevEvolutionRef = useRef<EvolutionKey | null>(null);
  const antiYouPnlRef = useRef(0);
  const prevGlitchLevelRef = useRef(0);

  const tiltColor = TILT_ZONE_COLORS[tiltZone];
  const showTiltWarning = tiltScore > 40;
  const isOnTilt = tiltScore > 60;

  const displayName =
    useTradeStore((s) => s.availableSymbols.find((sym) => sym.symbol === s.selectedAsset)?.display_name) ??
    selectedAsset;

  const [evolution, setEvolution] = useState<EvolutionKey>('MIRROR');

  useEffect(() => {
    setEvolution(evolutionKeyFromSessionTrades(sessionTrades));
  }, [sessionTrades]);

  const winRate = useMemo(() => {
    if (sessionTrades === 0) return 0;
    return Math.round((sessionWins / sessionTrades) * 100);
  }, [sessionTrades, sessionWins]);

  const ayWinRate = useMemo(() => {
    if (antiYouTrades === 0) return 0;
    return Math.round((antiYouWins / antiYouTrades) * 100);
  }, [antiYouTrades, antiYouWins]);

  const deltaPnl = sessionPnl - antiYouPnl;
  const antiYouLead = antiYouPnl - sessionPnl;
  const glitchLevel = computeGlitchLevel(antiYouLead);

  const decoyEfficiency = useMemo(
    () => (successfulDecoys / Math.max(decoyCount, 1)) * 100,
    [successfulDecoys, decoyCount]
  );

  const canDecoy =
    decoysThisRound < MAX_DECOYS_PER_ROUND &&
    decoyCount < MAX_DECOYS_PER_SESSION &&
    isLive &&
    !activePosition;

  useEffect(() => {
    const prevLevel = prevGlitchLevelRef.current;
    prevGlitchLevelRef.current = glitchLevel;
    if (prevLevel > 0 && glitchLevel === 0 && antiYouLead < 0) {
      setDeglitchPlaying(true);
      const t = setTimeout(() => setDeglitchPlaying(false), 800);
      return () => clearTimeout(t);
    }
  }, [glitchLevel, antiYouLead]);

  const getMergedHistory = useCallback(
    (realHistory: { status: string; direction: TradeDirection }[]) => {
      const decoys = decoyHistoryRef.current;
      if (decoys.length === 0) return realHistory;
      return [...decoys, ...realHistory];
    },
    []
  );

  const handlePlaceDecoy = useCallback(() => {
    if (!canDecoy) return;

    const decoyDirection = selectedDirection;
    decoyHistoryRef.current = [
      { status: 'closed', direction: decoyDirection },
      ...decoyHistoryRef.current,
    ];

    setDecoyCount((c) => c + 1);
    setDecoysThisRound((r) => r + 1);

    const state = useTradeStore.getState();
    const planBefore = computeShadowPlan(
      state.sessionTrades,
      decoyDirection,
      selectedStake * 0.25,
      state.tradeHistory
    );
    const mergedHistory = getMergedHistory(state.tradeHistory);
    const planAfter = computeShadowPlan(
      state.sessionTrades,
      decoyDirection,
      selectedStake * 0.25,
      mergedHistory
    );

    if (planBefore.ayDirection !== planAfter.ayDirection) {
      setSuccessfulDecoys((s) => s + 1);
      setAntiYouConfidence((c) => Math.max(0, c - 15));
    }

    setShadowRows((rows) =>
      [
        {
          id: uniqueId('decoy'),
          asset: displayName,
          direction: planAfter.ayDirection,
          stake: selectedStake * 0.25,
          pnl: 0,
          stage: planAfter.stage,
          at: Date.now(),
          isDecoy: true,
        },
        ...rows,
      ].slice(0, 24)
    );
  }, [canDecoy, selectedDirection, selectedStake, displayName, getMergedHistory]);

  const handlePlaceTrade = async () => {
    if (!isLive || isPlacingTrade || hasActiveSimulation()) return;
    sfx.play('trade_place');
    setIsPlacingTrade(true);
    setTradeError(null);

    const before = useTradeStore.getState();
    const result = await placeSimulatedTrade({
      asset: selectedAsset,
      assetDisplayName: displayName,
      direction: selectedDirection,
      stake: selectedStake,
      duration: selectedDuration,
      durationUnit: selectedDurationUnit,
    });

    if (!result.success) {
      setTradeError(result.error ?? 'Trade failed');
      setIsPlacingTrade(false);
      return;
    }

    const after = useTradeStore.getState();
    const newest = after.tradeHistory[0];
    if (newest) {
      const mergedHistory = getMergedHistory(after.tradeHistory);
      const plan = computeShadowPlan(
        before.sessionTrades,
        selectedDirection,
        selectedStake,
        mergedHistory
      );
      pendingShadowRef.current = {
        tradeId: newest.id,
        ayDirection: plan.ayDirection,
        ayStake: plan.ayStake,
        stage: plan.stage,
      };
    }

    setDecoysThisRound(0);
    setIsPlacingTrade(false);
  };

  useEffect(() => {
    if (sessionTrades <= prevTradesRef.current || !isLive) {
      prevTradesRef.current = sessionTrades;
      return;
    }
    prevTradesRef.current = sessionTrades;

    const pending = pendingShadowRef.current;
    const closed =
      pending &&
      useTradeStore.getState().tradeHistory.find((t) => t.id === pending.tradeId && t.status !== 'active');

    if (!pending || !closed || closed.status === 'active') {
      pendingShadowRef.current = null;
      return;
    }

    const ayDelta = shadowPnlFromClosedTrade(closed, pending);
    pendingShadowRef.current = null;

    const ts = useTradeStore.getState();
    const tilt = useTiltStore.getState().score;
    const nextAy = antiYouPnlRef.current + ayDelta;
    antiYouPnlRef.current = nextAy;

    const userWonThisTrade = (closed.pnl ?? 0) > 0;
    const currentGlitch = computeGlitchLevel(nextAy - ts.sessionPnl);

    let nextGlitchWins = tradesWonWhileGlitched;
    if (userWonThisTrade && currentGlitch >= 1) {
      nextGlitchWins += 1;
      setTradesWonWhileGlitched(nextGlitchWins);
    }

    if (ayDelta > 0) {
      setAntiYouConfidence((c) => Math.min(100, c + 5));
    }

    setAntiYouPnl(nextAy);
    setAntiYouTrades((n) => n + 1);
    if (ayDelta > 0) setAntiYouWins((w) => w + 1);

    setShadowRows((rows) =>
      [
        {
          id: `${closed.id}-shadow`,
          asset: closed.assetDisplayName ?? closed.asset,
          direction: pending.ayDirection,
          stake: pending.ayStake,
          pnl: ayDelta,
          stage: pending.stage,
          at: Date.now(),
        },
        ...rows,
      ].slice(0, 24)
    );

    setEquityHistory((h) =>
      [...h, { time: Date.now(), yourPnl: ts.sessionPnl, ayPnl: nextAy }].slice(-80)
    );

    const behavioral = Math.max(0, 100 - tilt);
    const glitchSurvival = nextGlitchWins * 10;
    const dEff = (successfulDecoys / Math.max(decoyCount, 1)) * 100;
    const score =
      (ts.sessionPnl - nextAy) * 0.4 +
      dEff * 0.2 +
      glitchSurvival * 0.2 +
      behavioral * 0.2;

    onScoreUpdate({
      score: Math.max(0, score),
      pnl: ts.sessionPnl,
      trades_count: ts.sessionTrades,
      behavioral_score: behavioral,
    });
  }, [sessionTrades, isLive, onScoreUpdate, tradesWonWhileGlitched, successfulDecoys, decoyCount]);

  useEffect(() => {
    if (prevEvolutionRef.current === null) {
      prevEvolutionRef.current = evolution;
      return;
    }
    if (prevEvolutionRef.current !== evolution) {
      sfx.play('stage_shift');
      setStageFlash(evolution);
      const t = setTimeout(() => setStageFlash(null), 2400);
      prevEvolutionRef.current = evolution;
      return () => clearTimeout(t);
    }
  }, [evolution]);

  const chartW = 320;
  const chartH = 112;
  const paths = useMemo(() => {
    if (equityHistory.length === 0) {
      return { you: '', ay: '', min: 0, max: 1 };
    }
    const vals = equityHistory.flatMap((p) => [p.yourPnl, p.ayPnl]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const n = equityHistory.length;
    const toPath = (key: 'yourPnl' | 'ayPnl') =>
      equityHistory
        .map((pt, i) => {
          const x = (i / Math.max(1, n - 1)) * chartW;
          const y =
            chartH - ((pt[key] - min) / range) * (chartH - 12) - 6;
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ');
    return { you: toPath('yourPnl'), ay: toPath('ayPnl'), min, max };
  }, [equityHistory]);

  const yourTradesList = useMemo(
    () =>
      tradeHistory
        .filter((t) => t.status !== 'active')
        .slice(0, 14),
    [tradeHistory]
  );

  const stageIndex = STAGE_ORDER.indexOf(evolution);

  const mainContainerStyle: React.CSSProperties = useMemo(() => {
    if (glitchLevel >= 3) return { filter: 'invert(0.85) hue-rotate(180deg)' };
    if (glitchLevel >= 1) return { filter: 'hue-rotate(10deg)' };
    return {};
  }, [glitchLevel]);

  const chartContainerStyle: React.CSSProperties = useMemo(() => {
    if (glitchLevel >= 2) return { transform: 'scaleX(-1)' };
    return {};
  }, [glitchLevel]);

  const riseFirst = glitchLevel < 2;

  return (
    <div
      className="space-y-0"
      style={{
        ...mainContainerStyle,
        animation: deglitchPlaying ? 'deglitch 0.8s ease-out' : undefined,
      }}
    >
      <style>{`
        @keyframes text-glitch {
          0%, 90%, 100% { opacity: 1; transform: translate(0); }
          92% { opacity: 0.7; transform: translate(-2px, 1px); }
          94% { opacity: 0.9; transform: translate(1px, -1px); }
          96% { opacity: 0.6; transform: translate(2px, 0); }
          98% { opacity: 1; transform: translate(-1px, 1px); }
        }
        @keyframes deglitch {
          0% { filter: invert(0.85) hue-rotate(180deg); transform: scale(1.02); }
          30% { filter: hue-rotate(90deg); transform: scale(0.99); }
          60% { filter: hue-rotate(20deg); transform: scale(1.005); }
          100% { filter: none; transform: scale(1); }
        }
      `}</style>

      <span className="sr-only">
        Anti-You duel instance {instanceId} player {userId}
      </span>

      {glitchLevel >= 1 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="text-center py-2 text-[10px] font-mono font-bold tracking-wider border border-red-500/20 rounded-lg mb-2"
          style={{
            color: glitchLevel >= 3 ? '#ff2222' : '#f97316',
            background: glitchLevel >= 3 ? 'rgba(255,0,0,0.08)' : 'rgba(249,115,22,0.06)',
          }}
        >
          Anti-You is corrupting your interface
        </motion.div>
      )}

      {glitchLevel >= 3 && (
        <div
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
          style={{ mixBlendMode: 'difference' }}
        >
          <span
            className="text-4xl font-black tracking-widest uppercase"
            style={{
              color: 'rgba(255,0,0,0.35)',
              textShadow: '0 0 40px rgba(255,0,0,0.3)',
              animation: 'text-glitch 1.5s infinite',
            }}
          >
            SYSTEM CORRUPTED
          </span>
        </div>
      )}

      <div
        className="rounded-t-2xl border border-white/[0.06] overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(16,185,129,0.04) 0%, rgba(10,10,18,0.96) 45%, rgba(139,92,246,0.05) 100%)',
        }}
      >
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" style={{ color: EMERALD }} />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
                Dual equity
              </span>
            </div>
            <motion.span
              key={deltaPnl}
              initial={{ opacity: 0.6, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-mono font-bold tabular-nums"
              style={{
                color: deltaPnl >= 0 ? EMERALD : '#fb7185',
                animation: glitchLevel >= 1 ? 'text-glitch 2s infinite' : undefined,
              }}
            >
              Δ {formatCurrency(deltaPnl)}
            </motion.span>
          </div>

          <svg
            width="100%"
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="overflow-visible"
            style={chartContainerStyle}
          >
            <defs>
              <linearGradient id="ayFillYou" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={EMERALD} stopOpacity="0.12" />
                <stop offset="100%" stopColor={EMERALD} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ayFillAy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={AY_ORANGE} stopOpacity="0.1" />
                <stop offset="100%" stopColor={AY_PURPLE} stopOpacity="0" />
              </linearGradient>
            </defs>
            {equityHistory.length > 1 && (
              <>
                <path
                  d={`${paths.ay} L ${chartW} ${chartH} L 0 ${chartH} Z`}
                  fill="url(#ayFillAy)"
                  opacity={0.5}
                />
                <path
                  d={`${paths.you} L ${chartW} ${chartH} L 0 ${chartH} Z`}
                  fill="url(#ayFillYou)"
                  opacity={0.35}
                />
              </>
            )}
            <path
              d={paths.ay}
              fill="none"
              stroke={AY_ORANGE}
              strokeWidth={1.75}
              strokeDasharray="5 4"
              opacity={0.95}
            />
            <path d={paths.you} fill="none" stroke={EMERALD} strokeWidth={2.25} />
          </svg>
          <div className="flex justify-between mt-2 text-[10px] font-mono">
            <span
              style={{
                color: EMERALD,
                animation: glitchLevel >= 1 ? 'text-glitch 2s infinite' : undefined,
              }}
            >
              You {formatCurrency(sessionPnl)}
            </span>
            <span
              style={{
                color: AY_ORANGE,
                animation: glitchLevel >= 1 ? 'text-glitch 2s infinite 0.3s' : undefined,
              }}
            >
              Anti-You {formatCurrency(antiYouPnl)}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">
              Anti-You Confidence
            </span>
            <span
              className="text-[10px] font-mono font-bold tabular-nums"
              style={{
                color: antiYouConfidence > 70 ? '#f43f5e' : antiYouConfidence > 40 ? AY_ORANGE : EMERALD,
              }}
            >
              {antiYouConfidence}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={false}
              animate={{
                width: `${antiYouConfidence}%`,
                background:
                  antiYouConfidence > 70
                    ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
                    : antiYouConfidence > 40
                      ? `linear-gradient(90deg, ${AY_ORANGE}, ${AY_PURPLE})`
                      : `linear-gradient(90deg, ${EMERALD}, #34d399)`,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            />
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">
              Evolution
            </span>
            <motion.span
              key={evolution}
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
              style={{
                color: EVOLUTION_META[evolution].accent,
                borderColor: EVOLUTION_META[evolution].ring,
                background: `${EVOLUTION_META[evolution].accent}12`,
              }}
            >
              {EVOLUTION_META[evolution].label}
            </motion.span>
          </div>
          <div className="flex gap-1">
            {STAGE_ORDER.map((st, i) => {
              const active = i === stageIndex;
              const done = i < stageIndex;
              const meta = EVOLUTION_META[st];
              return (
                <motion.div
                  key={st}
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    boxShadow: active ? `0 0 12px ${meta.ring}` : undefined,
                  }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    initial={false}
                    animate={{
                      width: done || active ? '100%' : '28%',
                      opacity: done || active ? 1 : 0.35,
                      background: done
                        ? `linear-gradient(90deg, ${meta.accent}, ${AY_PURPLE})`
                        : active
                          ? `linear-gradient(90deg, ${meta.accent}, ${meta.accent}88)`
                          : 'rgba(255,255,255,0.08)',
                    }}
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                </motion.div>
              );
            })}
          </div>
          <p className="text-[10px] text-text-muted mt-2 leading-relaxed">
            {EVOLUTION_META[evolution].blurb}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {stageFlash && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="border-x border-white/[0.06] px-4 py-2 text-center text-xs font-semibold"
            style={{
              background: `${EVOLUTION_META[stageFlash].accent}10`,
              color: EVOLUTION_META[stageFlash].accent,
            }}
          >
            Stage shift → {EVOLUTION_META[stageFlash].label}: {EVOLUTION_META[stageFlash].blurb}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="border-x border-white/[0.06]" style={chartContainerStyle}>
        <LiveChart height={180} compact />
      </div>

      {isLive && (
        <div
          className="rounded-b-2xl border border-t-0 border-white/[0.06] p-4"
          style={{
            background: 'rgba(10, 10, 18, 0.95)',
            borderColor: showTiltWarning ? `${tiltColor}30` : undefined,
            boxShadow: showTiltWarning ? `inset 0 0 28px ${tiltColor}08` : undefined,
            transition: 'border-color 2s ease, box-shadow 2s ease',
          }}
        >
          <AnimatePresence mode="wait">
            {activePosition ? (
              <motion.div
                key="active-trade"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    borderColor:
                      activePosition.currentPnl >= 0
                        ? 'rgba(16,185,129,0.25)'
                        : 'rgba(239,68,68,0.25)',
                    background:
                      activePosition.currentPnl >= 0
                        ? 'rgba(16,185,129,0.04)'
                        : 'rgba(239,68,68,0.04)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-text-primary">
                      {activePosition.asset}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        activePosition.direction === 'CALL'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {activePosition.direction === 'CALL' ? 'RISE' : 'FALL'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-text-muted">Entry</div>
                      <div className="text-sm font-bold text-text-primary tabular-nums font-mono">
                        {activePosition.entrySpot.toFixed(5)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-text-muted">Live P&amp;L</div>
                      <div
                        className={`text-2xl font-black tabular-nums font-mono ${
                          activePosition.currentPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {formatCurrency(activePosition.currentPnl)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[9px] text-text-muted mb-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Time remaining
                    </span>
                    <span className="font-mono">Running…</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${EMERALD}, ${AY_PURPLE})`,
                      }}
                      animate={{ width: ['0%', '100%'] }}
                      transition={{ duration: selectedDuration * 60, ease: 'linear' }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => sellSimulatedTradeEarly()}
                  className="w-full h-10 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/5 transition-all flex items-center justify-center gap-2"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Sell Early
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="trade-form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-bold text-text-primary uppercase tracking-wider"
                      style={{ textShadow: `0 0 20px ${AY_PURPLE}40` }}
                    >
                      Anti-You duel
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-white/[0.04] text-text-muted border border-white/[0.08]">
                      SIM
                    </span>
                  </div>
                  <RankBadge size="sm" />
                </div>

                <SymbolSelector compact />

                <div className="grid grid-cols-2 gap-2">
                  {riseFirst ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedDirection('CALL')}
                        className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all border ${
                          selectedDirection === 'CALL'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]'
                            : 'bg-white/[0.03] border-white/[0.08] text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        <TrendingUp className="w-4 h-4" />
                        RISE
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDirection('PUT')}
                        className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all border ${
                          selectedDirection === 'PUT'
                            ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]'
                            : 'bg-white/[0.03] border-white/[0.08] text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        <TrendingDown className="w-4 h-4" />
                        FALL
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedDirection('PUT')}
                        className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all border ${
                          selectedDirection === 'PUT'
                            ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]'
                            : 'bg-white/[0.03] border-white/[0.08] text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        <TrendingDown className="w-4 h-4" />
                        FALL
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDirection('CALL')}
                        className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all border ${
                          selectedDirection === 'CALL'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]'
                            : 'bg-white/[0.03] border-white/[0.08] text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        <TrendingUp className="w-4 h-4" />
                        RISE
                      </button>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5 block font-mono">
                      Stake (USD)
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={selectedStake}
                        onChange={(e) => setSelectedStake(Number(e.target.value))}
                        min={1}
                        max={1000}
                        className="flex-1 h-9 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/30 focus:outline-none text-xs text-text-primary tabular-nums font-mono"
                      />
                      {[10, 25, 50].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSelectedStake(preset)}
                          className={`px-2 h-9 rounded-lg text-[10px] font-bold transition-all border ${
                            selectedStake === preset
                              ? 'border-violet-500/30 text-violet-300 bg-violet-500/10'
                              : 'border-white/[0.08] text-text-muted hover:text-text-secondary'
                          }`}
                        >
                          ${preset}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-text-muted uppercase tracking-wider mb-1.5 block font-mono">
                      Duration
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {DURATION_PRESETS.map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => setSelectedDuration(preset.value)}
                          className={`h-9 rounded-lg text-[10px] font-bold transition-all border ${
                            selectedDuration === preset.value
                              ? 'border-violet-500/30 text-violet-300 bg-violet-500/10'
                              : 'border-white/[0.08] text-text-muted hover:text-text-secondary'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[9px] font-mono text-text-muted px-1">
                  <span>
                    Decoys: {MAX_DECOYS_PER_ROUND - decoysThisRound}/{MAX_DECOYS_PER_ROUND} ({MAX_DECOYS_PER_SESSION - decoyCount}/{MAX_DECOYS_PER_SESSION} total)
                  </span>
                  <span>Cost: {formatCurrency(selectedStake * 0.25)}</span>
                </div>

                {tradeError && (
                  <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-1.5">
                    {tradeError}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePlaceTrade}
                    disabled={isPlacingTrade || selectedStake <= 0}
                    className="flex-1 h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-white disabled:opacity-40"
                    style={{
                      background: isOnTilt
                        ? `linear-gradient(135deg, ${tiltColor}80, ${tiltColor})`
                        : selectedDirection === 'CALL'
                          ? 'linear-gradient(135deg, #059669, #10b981)'
                          : 'linear-gradient(135deg, #dc2626, #ef4444)',
                    }}
                  >
                    {isPlacingTrade ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        {selectedDirection === 'CALL' ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        Trade · {formatCurrency(selectedStake)}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handlePlaceDecoy}
                    disabled={!canDecoy}
                    className="h-12 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 border disabled:opacity-30"
                    style={{
                      borderColor: canDecoy ? `${AY_PURPLE}50` : 'rgba(255,255,255,0.08)',
                      color: canDecoy ? AY_PURPLE : undefined,
                      background: canDecoy ? `${AY_PURPLE}10` : 'rgba(255,255,255,0.03)',
                    }}
                  >
                    <Ghost className="w-3.5 h-3.5" />
                    Decoy
                  </button>
                </div>

                {showTiltWarning && (
                  <div
                    className="flex items-center gap-2 text-[10px] rounded-lg px-3 py-2 border"
                    style={{
                      color: tiltColor,
                      borderColor: `${tiltColor}25`,
                      background: `${tiltColor}08`,
                    }}
                  >
                    <Zap className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
                    <span className="font-mono">
                      Tilt {tiltScore}/100 — clone exploits emotional leaks
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <motion.div
          layout
          className="rounded-xl border p-3 min-h-[140px] max-h-[200px] overflow-y-auto"
          style={{
            borderColor: `${EMERALD}35`,
            background: 'rgba(16,185,129,0.04)',
            boxShadow: `inset 0 0 24px rgba(16,185,129,0.06)`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <User className="w-3.5 h-3.5" style={{ color: EMERALD }} />
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">
              Your trades
            </span>
          </div>
          <div className="space-y-2">
            {yourTradesList.length === 0 ? (
              <p className="text-[10px] text-text-muted">No closed trades yet.</p>
            ) : (
              yourTradesList.map((t) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex justify-between gap-2 text-[10px] font-mono border-b border-white/[0.04] pb-1.5 last:border-0"
                >
                  <span className="text-text-secondary truncate">{t.assetDisplayName ?? t.asset}</span>
                  <span
                    className="tabular-nums flex-shrink-0"
                    style={{ color: (t.pnl ?? 0) >= 0 ? EMERALD : '#fb7185' }}
                  >
                    {(t.pnl ?? 0) >= 0 ? '+' : ''}
                    {formatCurrency(t.pnl ?? 0)}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div
          layout
          className="rounded-xl border p-3 min-h-[140px] max-h-[200px] overflow-y-auto"
          style={{
            borderColor: `${AY_ORANGE}40`,
            background: `linear-gradient(145deg, rgba(249,115,22,0.07), rgba(139,92,246,0.06))`,
            boxShadow: `inset 0 0 24px ${AY_PURPLE}12`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Ghost className="w-3.5 h-3.5" style={{ color: AY_ORANGE }} />
            <span className="text-[9px] font-mono uppercase tracking-wider text-text-muted">
              Anti-You shadow
            </span>
          </div>
          <div className="space-y-2">
            {shadowRows.length === 0 ? (
              <p className="text-[10px] text-text-muted">Shadow fills when your trades close.</p>
            ) : (
              shadowRows.map((s) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex justify-between gap-2 text-[10px] font-mono border-b border-white/[0.04] pb-1.5 last:border-0"
                >
                  <span className="text-text-secondary truncate">
                    {s.isDecoy ? '👻 ' : ''}
                    {s.direction === 'CALL' ? '↑' : '↓'} {s.asset}
                  </span>
                  <span
                    className="tabular-nums flex-shrink-0"
                    style={{ color: s.isDecoy ? AY_PURPLE : s.pnl >= 0 ? AY_ORANGE : '#c084fc' }}
                  >
                    {s.isDecoy
                      ? 'DECOY'
                      : `${s.pnl >= 0 ? '+' : ''}${formatCurrency(s.pnl)}`}
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
        {[
          { label: 'Your P&L', value: formatCurrency(sessionPnl), color: sessionPnl >= 0 ? EMERALD : '#fb7185' },
          { label: 'AY P&L', value: formatCurrency(antiYouPnl), color: AY_ORANGE },
          { label: 'Delta', value: formatCurrency(deltaPnl), color: deltaPnl >= 0 ? EMERALD : '#fb7185' },
          { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 50 ? EMERALD : '#fb7185' },
          {
            label: 'Evolution Stage',
            value: EVOLUTION_META[evolution].label,
            color: EVOLUTION_META[evolution].accent,
          },
          {
            label: 'Glitch Level',
            value: `${glitchLevel}/3`,
            color: glitchLevel >= 2 ? '#f43f5e' : glitchLevel >= 1 ? AY_ORANGE : EMERALD,
          },
        ].map((row) => (
          <motion.div
            key={row.label}
            initial={false}
            whileHover={{ y: -1 }}
            className="glass rounded-xl p-3 text-center border border-white/[0.06]"
          >
            <div className="text-[8px] text-text-muted uppercase tracking-wider">{row.label}</div>
            <div
              className="text-sm font-mono font-bold tabular-nums mt-1"
              style={{ color: row.color }}
            >
              {row.value}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-text-muted font-mono text-center">
        AY win rate {ayWinRate}% · trades {sessionTrades} · decoys {decoyCount}/{MAX_DECOYS_PER_SESSION} · efficiency {Math.round(decoyEfficiency)}%
      </div>
    </div>
  );
}
