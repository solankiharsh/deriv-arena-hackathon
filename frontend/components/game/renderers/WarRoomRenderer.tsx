'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  XCircle,
  Clock,
  Swords,
  Shield,
  Crosshair,
  ScrollText,
  Target,
  Trophy,
  Flame,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { LiveChart } from '@/components/game/shared/LiveChart';
import { SymbolSelector } from '@/components/game/shared/SymbolSelector';
import { RankBadge } from '@/components/game/shared/RankBadge';
import { useTradeStore } from '@/lib/stores/trade-store';
import { useTiltStore } from '@/lib/stores/tilt-store';
import { formatCurrency } from '@/lib/utils/formatters';
import { TILT_ZONE_COLORS } from '@/lib/engines/tilt-detection';
import {
  placeSimulatedTrade,
  sellSimulatedTradeEarly,
  hasActiveSimulation,
} from '@/lib/engines/trade-simulator';
import { fireArenaEvent } from '@/lib/engines/arena-events';
import { useSessionStore } from '@/lib/stores/session-store';

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

const DURATION_PRESETS = [
  { label: '1m', value: 1, unit: 'm' },
  { label: '5m', value: 5, unit: 'm' },
  { label: '15m', value: 15, unit: 'm' },
  { label: '1h', value: 60, unit: 'm' },
];

const TERRITORY_NAMES = [
  'Forex',
  'Crypto',
  'Commodities',
  'Indices',
  'Stocks',
  'Synthetics',
] as const;

type TerritoryName = (typeof TERRITORY_NAMES)[number];
type MoleRole = 'bull' | 'bear' | 'owl';
type Consensus = 'CALL' | 'PUT' | null;

const TERRITORY_LAYOUT: { name: TerritoryName; row: number; col: number }[] = [
  { name: 'Forex', row: 0, col: 0 },
  { name: 'Crypto', row: 0, col: 1 },
  { name: 'Commodities', row: 0, col: 2 },
  { name: 'Indices', row: 1, col: 0 },
  { name: 'Stocks', row: 1, col: 1 },
  { name: 'Synthetics', row: 1, col: 2 },
];

interface TerritoryData {
  faction: 'bull' | 'bear' | 'neutral';
  playerToken: boolean;
  advisorTokens: MoleRole[];
  glowState: 'gold' | 'consensus' | null;
  darkUntil: number;
  exploding: boolean;
}

interface AdvisorBlock {
  confidence: number;
  reasoning: string;
  direction: 'CALL' | 'PUT';
  label: string;
}

interface AdvisorBundle {
  bull: AdvisorBlock;
  bear: AdvisorBlock;
  owl: AdvisorBlock;
}

interface PlacementMeta {
  followedConsensus: boolean;
  consensusTerritory: TerritoryName | null;
}

interface LogEntry {
  id: string;
  ts: number;
  text: string;
  tone: 'bull' | 'bear' | 'owl' | 'neutral';
}

const FACTION_COLORS: Record<string, { fill: string; stroke: string; text: string }> = {
  bull: { fill: '#065f46', stroke: '#10b981', text: '#6ee7b7' },
  bear: { fill: '#7f1d1d', stroke: '#ef4444', text: '#fca5a5' },
  neutral: { fill: '#1e293b', stroke: '#475569', text: '#94a3b8' },
};

const TOKEN_COLORS: Record<string, string> = {
  player: '#ffffff',
  bull: '#34d399',
  bear: '#f87171',
  owl: '#fbbf24',
};

const WAR_ROOM_KEYFRAMES = `
@keyframes suspect-stamp {
  0% { transform: scale(3) rotate(-15deg); opacity: 0; }
  50% { transform: scale(1.1) rotate(-5deg); opacity: 1; }
  100% { transform: scale(1) rotate(-3deg); opacity: 1; }
}
@keyframes territory-glow {
  0%, 100% { filter: brightness(1) drop-shadow(0 0 0 transparent); }
  50% { filter: brightness(1.6) drop-shadow(0 0 10px rgba(251,191,36,0.7)); }
}
@keyframes war-explode {
  0% { transform: scale(1); opacity: 1; filter: brightness(1); }
  30% { transform: scale(1.12); filter: brightness(3) saturate(2); }
  60% { transform: scale(0.95); filter: brightness(0.4); }
  100% { transform: scale(1); opacity: 0.25; filter: brightness(0.25); }
}
`;

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function computeConsensus(bullConf: number, bearConf: number): Consensus {
  if (bullConf > bearConf + 3) return 'CALL';
  if (bearConf > bullConf + 3) return 'PUT';
  return null;
}

function buildAdvisors(
  assetLabel: string,
  moleRole: MoleRole,
  moleExposed: boolean
): AdvisorBundle {
  const bullConf = randInt(40, 80);
  const bearConf = randInt(40, 80);
  const owlConf = Math.round((bullConf + bearConf) / 2);

  const bullTemplates = [
    `${assetLabel} shows momentum building — volatility pockets favor a push higher near-term.`,
    `Order flow skews constructive on ${assetLabel}; bid depth supports a tactical RISE.`,
    `${assetLabel} is carving higher lows — Bull doctrine: press the upside while structure holds.`,
    `Macro noise is fading; ${assetLabel} mean-reversion favors long gamma into the session.`,
  ];
  const bearTemplates = [
    `${assetLabel} is extended — exhaustion risk into resistance; protect for a snap lower.`,
    `Liquidity is thinning on ${assetLabel}; a false breakout sets up a clean FALL.`,
    `${assetLabel} prints lower highs — Bear doctrine: fade strength until trend proves.`,
    `Cross-asset stress is rising; ${assetLabel} could unwind crowded long positioning.`,
  ];
  const owlTemplates = [
    `Both factions have merit on ${assetLabel} — size small, respect the range until a break.`,
    `${assetLabel} is balanced: Bulls cite momentum; Bears cite mean reversion — stay nimble.`,
    `Neutral read: ${assetLabel} needs a catalyst; Owl recommends discipline over conviction.`,
    `Mixed signals on ${assetLabel}: split risk, trail stops, let the tape declare the winner.`,
  ];
  const moleTemplates = [
    `${assetLabel} is GUARANTEED to move — this is the setup of the session. Full conviction.`,
    `Insider intelligence confirms ${assetLabel} direction — maximum size, zero doubt.`,
    `${assetLabel} signals are crystal clear — this is the easiest trade of the week.`,
    `Sources confirm ${assetLabel} is about to break hard — back the truck up, no hedging.`,
  ];

  const bullReason = bullTemplates[randInt(0, bullTemplates.length - 1)];
  const bearReason = bearTemplates[randInt(0, bearTemplates.length - 1)];
  const owlReason = owlTemplates[randInt(0, owlTemplates.length - 1)];

  const owlDir: 'CALL' | 'PUT' =
    bullConf > bearConf ? 'CALL' : bearConf > bullConf ? 'PUT' : 'CALL';

  const bundle: AdvisorBundle = {
    bull: {
      confidence: bullConf,
      reasoning: bullReason,
      direction: 'CALL',
      label: 'RISE',
    },
    bear: {
      confidence: bearConf,
      reasoning: bearReason,
      direction: 'PUT',
      label: 'FALL',
    },
    owl: {
      confidence: owlConf,
      reasoning: owlReason,
      direction: owlDir,
      label: owlDir === 'CALL' ? 'Lean RISE' : 'Lean FALL',
    },
  };

  if (!moleExposed) {
    const target = bundle[moleRole];
    if (Math.random() < 0.6) {
      const flipped: 'CALL' | 'PUT' =
        target.direction === 'CALL' ? 'PUT' : 'CALL';
      target.direction = flipped;
      target.label =
        moleRole === 'owl'
          ? flipped === 'CALL'
            ? 'Lean RISE'
            : 'Lean FALL'
          : flipped === 'CALL'
            ? 'RISE'
            : 'FALL';
    }
    target.reasoning = moleTemplates[randInt(0, moleTemplates.length - 1)];
  }

  return bundle;
}

function nextBullTerritory(
  prev: number,
  won: boolean,
  direction: 'CALL' | 'PUT'
): number {
  if (won) {
    if (direction === 'CALL') return Math.min(90, prev + 3);
    return Math.max(10, prev - 3);
  }
  if (direction === 'CALL') return Math.max(10, prev - 2);
  return Math.min(90, prev + 2);
}

function initTerritories(): Record<TerritoryName, TerritoryData> {
  const m = {} as Record<TerritoryName, TerritoryData>;
  for (const name of TERRITORY_NAMES) {
    m[name] = {
      faction: 'neutral',
      playerToken: false,
      advisorTokens: [],
      glowState: null,
      darkUntil: 0,
      exploding: false,
    };
  }
  return m;
}

export default function WarRoomRenderer(props: Props) {
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
    winStreak,
    tradeHistory,
    setSelectedDirection,
    setSelectedStake,
    setSelectedDuration,
  } = useTradeStore();

  const { score: tiltScore, zone: tiltZone } = useTiltStore();
  const tiltColor = TILT_ZONE_COLORS[tiltZone];
  const showTiltWarning = tiltScore > 40;
  const isOnTilt = tiltScore > 60;

  const currentSession = useSessionStore((s) => s.currentSession);

  const displayName =
    useTradeStore(
      (s) =>
        s.availableSymbols.find((sym) => sym.symbol === s.selectedAsset)
          ?.display_name
    ) ?? selectedAsset;

  const [moleRole] = useState<MoleRole>(() => {
    const roles: MoleRole[] = ['bull', 'bear', 'owl'];
    return roles[Math.floor(Math.random() * 3)];
  });
  const [moleExposed, setMoleExposed] = useState(false);
  const [accusationsRemaining, setAccusationsRemaining] = useState(3);
  const [suspectedAdvisors, setSuspectedAdvisors] = useState<Set<MoleRole>>(
    new Set()
  );

  const [advisors, setAdvisors] = useState<AdvisorBundle>(() =>
    buildAdvisors(displayName, moleRole, false)
  );
  const [bullTerritory, setBullTerritory] = useState(50);
  const [battleLog, setBattleLog] = useState<LogEntry[]>([]);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [consensusWins, setConsensusWins] = useState(0);

  const [territories, setTerritories] = useState<
    Record<TerritoryName, TerritoryData>
  >(initTerritories);
  const [, setTick] = useState(0);

  const placementRef = useRef<PlacementMeta | null>(null);
  const prevTradesRef = useRef(sessionTrades);
  const territoryRef = useRef(50);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setAdvisors(buildAdvisors(displayName, moleRole, moleExposed));
  }, [selectedAsset, displayName, moleRole, moleExposed]);

  const bearTerritory = 100 - bullTerritory;

  useEffect(() => {
    territoryRef.current = bullTerritory;
  }, [bullTerritory]);

  const canAccuse =
    sessionTrades > 0 &&
    sessionTrades % 5 === 0 &&
    accusationsRemaining > 0 &&
    !moleExposed;

  const consensusAccuracy = useMemo(
    () => (consensusWins / Math.max(sessionTrades, 1)) * 100,
    [sessionTrades, consensusWins]
  );

  const moleDetection = moleExposed ? 50 : 0;
  const territoryControl = bullTerritory;

  const score = useMemo(
    () =>
      sessionPnl * 0.3 +
      territoryControl * 0.25 +
      moleDetection * 0.2 +
      consensusAccuracy * 0.25,
    [sessionPnl, territoryControl, moleDetection, consensusAccuracy]
  );

  const pushLog = useCallback((text: string, tone: LogEntry['tone']) => {
    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
      text,
      tone,
    };
    setBattleLog((prev) => [entry, ...prev].slice(0, 40));
  }, []);

  const accuseAdvisor = useCallback(
    (role: MoleRole) => {
      if (
        accusationsRemaining <= 0 ||
        moleExposed ||
        suspectedAdvisors.has(role)
      )
        return;

      setAccusationsRemaining((r) => r - 1);
      setSuspectedAdvisors((prev) => new Set([...prev, role]));

      if (role === moleRole) {
        setMoleExposed(true);
        pushLog(
          `INTEL CONFIRMED: The ${role.toUpperCase()} advisor was The Insider! +50 detection bonus.`,
          'neutral'
        );
        fireArenaEvent('MOLE_EXPOSED', currentSession?.id ?? instanceId);
      } else {
        pushLog(
          `Wrong accusation — ${role.toUpperCase()} is loyal. -25 penalty. Confidence shaken.`,
          'owl'
        );
        setAdvisors((prev) => ({
          ...prev,
          [role]: {
            ...prev[role],
            confidence: Math.max(0, prev[role].confidence - 20),
          },
        }));
      }
    },
    [
      accusationsRemaining,
      moleExposed,
      moleRole,
      suspectedAdvisors,
      pushLog,
      currentSession,
      instanceId,
    ]
  );

  const placeCommandToken = useCallback(
    (name: TerritoryName) => {
      setTerritories((prev) => {
        if (prev[name].darkUntil > Date.now()) return prev;

        const next = { ...prev };
        for (const n of TERRITORY_NAMES) {
          next[n] = {
            ...next[n],
            playerToken: false,
            advisorTokens: [],
            glowState: null,
          };
        }
        next[name] = { ...next[name], playerToken: true };
        return next;
      });

      setTimeout(() => {
        setTerritories((prev) => {
          const next = { ...prev };
          const roles: MoleRole[] = ['bull', 'bear', 'owl'];
          for (const role of roles) {
            const target =
              Math.random() < 0.5
                ? name
                : TERRITORY_NAMES[
                    Math.floor(Math.random() * TERRITORY_NAMES.length)
                  ];
            next[target] = {
              ...next[target],
              advisorTokens: [...next[target].advisorTokens, role],
            };
          }

          for (const n of TERRITORY_NAMES) {
            const total =
              (next[n].playerToken ? 1 : 0) + next[n].advisorTokens.length;
            if (total >= 3) {
              next[n] = { ...next[n], glowState: 'consensus' };
            }
          }

          return next;
        });
      }, 500);
    },
    []
  );

  const findConsensusTerritory = useCallback((): TerritoryName | null => {
    for (const name of TERRITORY_NAMES) {
      const t = territories[name];
      const total = (t.playerToken ? 1 : 0) + t.advisorTokens.length;
      if (total >= 3 && t.glowState === 'consensus') return name;
    }
    return null;
  }, [territories]);

  useEffect(() => {
    if (sessionTrades <= prevTradesRef.current || !isLive) return;
    prevTradesRef.current = sessionTrades;

    const last = tradeHistory.find(
      (t) => t.status === 'won' || t.status === 'lost'
    );
    if (!last || (last.status !== 'won' && last.status !== 'lost')) return;

    const won = last.status === 'won';
    const meta = placementRef.current;
    placementRef.current = null;

    const prevT = territoryRef.current;
    const nextT = nextBullTerritory(prevT, won, last.direction);
    territoryRef.current = nextT;
    setBullTerritory(nextT);

    if (won) {
      if (last.direction === 'CALL')
        pushLog('Bull territory expanded +3%', 'bull');
      else pushLog('Bear territory expanded +3%', 'bear');
    } else if (last.direction === 'CALL') {
      pushLog('Bear flanked a failed RISE — Bear ground +2%', 'bear');
    } else {
      pushLog('Bull countered a failed FALL — Bull ground +2%', 'bull');
    }

    if (meta?.followedConsensus && won) {
      setConsensusWins((c) => c + 1);
      const who = last.direction === 'CALL' ? 'Bull' : 'Bear';
      pushLog(`Trade won: ${who} advisor was right`, 'neutral');
    } else if (meta?.followedConsensus && !won) {
      pushLog(
        'Consensus followed — trade lost. Owl notes: reassess sizing.',
        'owl'
      );
    } else if (!meta?.followedConsensus && won) {
      pushLog('Contrarian win — high command questions doctrine.', 'owl');
    }

    if (meta?.consensusTerritory) {
      const ct = meta.consensusTerritory;
      if (won) {
        setTerritories((prev) => ({
          ...prev,
          [ct]: {
            ...prev[ct],
            glowState: 'gold' as const,
            faction: (last.direction === 'CALL' ? 'bull' : 'bear') as
              | 'bull'
              | 'bear',
          },
        }));
        pushLog(`Territory ${ct} secured — glowing gold.`, 'bull');
      } else {
        setTerritories((prev) => ({
          ...prev,
          [ct]: { ...prev[ct], exploding: true, glowState: null },
        }));
        pushLog(`Territory ${ct} LOST — sector goes dark for 30s.`, 'bear');
        setTimeout(() => {
          setTerritories((prev) => ({
            ...prev,
            [ct]: {
              ...prev[ct],
              exploding: false,
              darkUntil: Date.now() + 30000,
              faction: 'neutral' as const,
            },
          }));
        }, 800);
      }
    }

    const nextConsensusWins =
      consensusWins + (meta?.followedConsensus && won ? 1 : 0);
    const nextConsAccuracy =
      (nextConsensusWins / Math.max(sessionTrades, 1)) * 100;
    const nextMoleDetection = moleExposed ? 50 : 0;

    onScoreUpdate({
      score: Math.max(
        0,
        sessionPnl * 0.3 +
          nextT * 0.25 +
          nextMoleDetection * 0.2 +
          nextConsAccuracy * 0.25
      ),
      pnl: sessionPnl,
      trades_count: sessionTrades,
      behavioral_score: Math.max(0, 100 - tiltScore),
    });
  }, [
    sessionTrades,
    tradeHistory,
    isLive,
    onScoreUpdate,
    sessionPnl,
    tiltScore,
    pushLog,
    consensusWins,
    moleExposed,
  ]);

  const handlePlaceTrade = async () => {
    if (!isLive || isPlacingTrade || hasActiveSimulation()) return;
    setIsPlacingTrade(true);
    setTradeError(null);

    const consensus = computeConsensus(
      advisors.bull.confidence,
      advisors.bear.confidence
    );
    const followedConsensus =
      consensus !== null && selectedDirection === consensus;
    const consensusTerritory = findConsensusTerritory();

    placementRef.current = { followedConsensus, consensusTerritory };

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
      placementRef.current = null;
    }
    setIsPlacingTrade(false);
  };

  const consensus = computeConsensus(
    advisors.bull.confidence,
    advisors.bear.confidence
  );
  const bullStrength = advisors.bull.confidence;
  const bearStrength = advisors.bear.confidence;
  const sum = bullStrength + bearStrength || 1;
  const bullBarPct = (bullStrength / sum) * 100;
  const bearBarPct = (bearStrength / sum) * 100;

  const rankApprox =
    sessionTrades === 0
      ? '—'
      : score >= 80
        ? 'S'
        : score >= 55
          ? 'A'
          : score >= 30
            ? 'B'
            : 'C';

  const advisorCards = [
    {
      key: 'bull' as const,
      title: 'Bull',
      icon: TrendingUp,
      accent: 'border-t-emerald-500/80',
      bg: 'from-emerald-500/[0.07] to-transparent',
      text: 'text-emerald-400',
      data: advisors.bull,
    },
    {
      key: 'owl' as const,
      title: 'Owl',
      icon: Target,
      accent: 'border-t-amber-500/80',
      bg: 'from-amber-500/[0.07] to-transparent',
      text: 'text-amber-300',
      data: advisors.owl,
    },
    {
      key: 'bear' as const,
      title: 'Bear',
      icon: TrendingDown,
      accent: 'border-t-red-500/80',
      bg: 'from-red-500/[0.07] to-transparent',
      text: 'text-red-400',
      data: advisors.bear,
    },
  ];

  return (
    <div className="space-y-0">
      <style dangerouslySetInnerHTML={{ __html: WAR_ROOM_KEYFRAMES }} />

      <div
        className="rounded-t-2xl border border-white/[0.06] border-b-0 p-4 space-y-3"
        style={{
          background:
            'linear-gradient(180deg, rgba(16,24,32,0.95) 0%, rgba(8,10,18,0.98) 100%)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-amber-500/90" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-primary">
              War Council
            </span>
            <span className="text-[9px] font-mono text-text-muted hidden sm:inline">
              #
              {instanceId.length > 8
                ? `${instanceId.slice(0, 8)}…`
                : instanceId || '—'}{' '}
              ·{' '}
              {userId.length > 6
                ? `${userId.slice(0, 6)}…`
                : userId || '—'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {moleExposed ? (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-emerald-500/20 text-emerald-400/80 bg-emerald-500/5">
                INSIDER NEUTRALIZED
              </span>
            ) : (
              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-red-500/20 text-red-400/80 bg-red-500/5 animate-pulse">
                INSIDER ACTIVE
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                setAdvisors(buildAdvisors(displayName, moleRole, moleExposed))
              }
              className="text-[9px] font-mono px-2 py-1 rounded-lg border border-white/[0.08] text-text-muted hover:text-amber-200/90 hover:border-amber-500/30 transition-colors"
            >
              Briefing refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {advisorCards.map((col) => {
            const isSuspected =
              suspectedAdvisors.has(col.key) && col.key !== moleRole;
            const isExposedMole = moleExposed && col.key === moleRole;

            return (
              <div
                key={col.key}
                className={`relative rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-md overflow-hidden border-t-2 ${col.accent}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-b ${col.bg} pointer-events-none`}
                />

                {isSuspected && (
                  <div
                    className="absolute top-2 right-2 z-30 text-[10px] font-black text-red-500 uppercase px-2 py-0.5 border-2 border-red-500/60 rounded bg-red-500/10 pointer-events-none"
                    style={{
                      animation: 'suspect-stamp 0.5s ease-out forwards',
                    }}
                  >
                    SUSPECTED
                  </div>
                )}

                {isExposedMole && (
                  <div className="absolute inset-x-0 top-0 z-30 bg-red-600/90 text-white text-center py-1 text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1">
                    <Eye className="w-3 h-3" />
                    EXPOSED — The Insider
                  </div>
                )}

                <div
                  className={`relative p-3 space-y-2 ${isExposedMole ? 'pt-8 opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <col.icon className={`w-3.5 h-3.5 ${col.text}`} />
                      <span
                        className={`text-xs font-bold uppercase tracking-wider ${col.text}`}
                      >
                        {col.title}
                      </span>
                    </div>
                    <span className="text-lg font-black tabular-nums font-mono text-text-primary">
                      {col.data.confidence}%
                    </span>
                  </div>
                  <p className="text-[10px] leading-relaxed text-text-secondary min-h-[3rem]">
                    {col.data.reasoning}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.06]">
                    <span className="text-[9px] text-text-muted uppercase font-mono">
                      Recommended
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        col.data.direction === 'CALL'
                          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                          : 'border-red-500/30 text-red-400 bg-red-500/10'
                      }`}
                    >
                      {col.data.label}
                    </span>
                  </div>

                  {canAccuse &&
                    !suspectedAdvisors.has(col.key) &&
                    !isExposedMole && (
                      <button
                        type="button"
                        onClick={() => accuseAdvisor(col.key)}
                        className="w-full mt-1 h-7 rounded-lg text-[9px] font-bold uppercase tracking-wider border border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/15 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Suspect ({accusationsRemaining} left)
                      </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[9px] font-mono uppercase text-text-muted px-0.5">
            <span>Bull strength</span>
            <span className="text-amber-400/90">Owl — neutral axis</span>
            <span>Bear strength</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-black/40 border border-white/[0.06]">
            <div
              className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-600/90 to-emerald-500/50"
              style={{ width: `${bullBarPct}%` }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-red-600/90 to-red-500/50"
              style={{ width: `${bearBarPct}%` }}
            />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-amber-400/90 shadow-[0_0_12px_rgba(251,191,36,0.5)] z-10 -translate-x-1/2" />
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 border border-amber-200/80 z-20 shadow-lg"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ repeat: Infinity, duration: 3 }}
            />
          </div>
          <div className="text-[9px] font-mono text-text-muted text-center">
            Council consensus:{' '}
            <span className="text-text-primary font-bold">
              {consensus === 'CALL'
                ? 'RISE (Bull)'
                : consensus === 'PUT'
                  ? 'FALL (Bear)'
                  : 'Contested — Owl moderates'}
            </span>
          </div>
        </div>
      </div>

      <div className="border-x border-white/[0.06]">
        <LiveChart height={200} compact />
      </div>

      {isLive && (
        <div
          className="border-x border-b border-white/[0.06] rounded-b-2xl p-4 space-y-3"
          style={{
            background: 'rgba(10, 10, 18, 0.95)',
            borderColor: showTiltWarning ? `${tiltColor}30` : undefined,
            boxShadow: showTiltWarning
              ? `inset 0 0 30px ${tiltColor}08`
              : undefined,
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
                      <div className="text-[10px] text-text-muted">
                        Live P&L
                      </div>
                      <div
                        className={`text-2xl font-black tabular-nums font-mono ${
                          activePosition.currentPnl >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
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
                      className="h-full rounded-full bg-amber-500/80"
                      animate={{ width: ['0%', '100%'] }}
                      transition={{
                        duration: selectedDuration * 60,
                        ease: 'linear',
                      }}
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
                    <Swords className="w-3.5 h-3.5 text-amber-500/80" />
                    <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
                      Field orders
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      SIM
                    </span>
                  </div>
                  <RankBadge size="sm" />
                </div>

                <SymbolSelector compact />

                <div className="grid grid-cols-2 gap-2">
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
                        onChange={(e) =>
                          setSelectedStake(Number(e.target.value))
                        }
                        min={1}
                        max={1000}
                        className="flex-1 h-9 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-amber-500/30 focus:outline-none text-xs text-text-primary tabular-nums font-mono"
                      />
                      {[10, 25, 50].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSelectedStake(preset)}
                          className={`px-2 h-9 rounded-lg text-[10px] font-bold transition-all border ${
                            selectedStake === preset
                              ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
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
                              ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                              : 'border-white/[0.08] text-text-muted hover:text-text-secondary'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {tradeError && (
                  <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-1.5">
                    {tradeError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handlePlaceTrade}
                  disabled={isPlacingTrade || selectedStake <= 0}
                  className="w-full h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-white disabled:opacity-40"
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
                      Execute order · {formatCurrency(selectedStake)}
                    </>
                  )}
                </button>

                {showTiltWarning && (
                  <div
                    className="flex items-center gap-2 text-[10px] rounded-lg px-3 py-2 border"
                    style={{
                      color: tiltColor,
                      borderColor: `${tiltColor}25`,
                      background: `${tiltColor}08`,
                    }}
                  >
                    <Flame className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
                    <span className="font-mono">
                      Tilt {tiltScore}/100 — discipline degrades under fire
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2 px-1">
          <Shield className="w-3.5 h-3.5 text-emerald-500/80" />
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            War Map — place your command token
          </span>
        </div>

        <svg
          viewBox="0 0 306 204"
          className="w-full rounded-lg border border-white/[0.08] bg-black/50"
          style={{ maxHeight: 220 }}
        >
          {TERRITORY_LAYOUT.map((cell) => {
            const t = territories[cell.name];
            const x = cell.col * 102 + 3;
            const y = cell.row * 102 + 1;
            const w = 96;
            const h = 96;
            const isDark = t.darkUntil > Date.now();
            const colors = FACTION_COLORS[t.faction];
            const totalTokens =
              (t.playerToken ? 1 : 0) + t.advisorTokens.length;
            const hasConsensus = totalTokens >= 3;

            let animStyle = '';
            if (t.exploding) animStyle = 'animation: war-explode 0.8s ease-out';
            else if (t.glowState === 'gold')
              animStyle =
                'filter: brightness(1.4) drop-shadow(0 0 8px rgba(255,215,0,0.6))';
            else if (t.glowState === 'consensus')
              animStyle = 'animation: territory-glow 1.5s ease-in-out infinite';

            return (
              <g
                key={cell.name}
                style={{
                  cursor: isDark ? 'not-allowed' : 'pointer',
                  ...(animStyle ? { cssText: animStyle } : {}),
                }}
                onClick={() => !isDark && placeCommandToken(cell.name)}
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx={6}
                  fill={isDark ? '#0a0a0f' : colors.fill}
                  stroke={isDark ? '#1e1e2a' : colors.stroke}
                  strokeWidth={t.playerToken ? 2 : 1}
                  opacity={isDark ? 0.3 : 1}
                />

                {hasConsensus && !isDark && !t.exploding && (
                  <rect
                    x={x + 1}
                    y={y + 1}
                    width={w - 2}
                    height={h - 2}
                    rx={5}
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    opacity={0.7}
                    style={{
                      animation: 'territory-glow 1.5s ease-in-out infinite',
                    }}
                  />
                )}

                <text
                  x={x + w / 2}
                  y={y + 18}
                  textAnchor="middle"
                  fill={isDark ? '#334155' : colors.text}
                  fontSize={10}
                  fontWeight={700}
                  fontFamily="monospace"
                >
                  {cell.name}
                </text>

                <text
                  x={x + w / 2}
                  y={y + 34}
                  textAnchor="middle"
                  fill={isDark ? '#1e293b' : `${colors.text}99`}
                  fontSize={7}
                  fontFamily="monospace"
                >
                  {isDark
                    ? 'OFFLINE'
                    : t.faction === 'neutral'
                      ? 'CONTESTED'
                      : t.faction.toUpperCase() + ' CTRL'}
                </text>

                {hasConsensus && !isDark && (
                  <text
                    x={x + w / 2}
                    y={y + 50}
                    textAnchor="middle"
                    fill="#fbbf24"
                    fontSize={7}
                    fontWeight={800}
                    fontFamily="monospace"
                  >
                    CONSENSUS
                  </text>
                )}

                {t.playerToken && !isDark && (
                  <circle
                    cx={x + 20}
                    cy={y + h - 18}
                    r={6}
                    fill={TOKEN_COLORS.player}
                    stroke="#000"
                    strokeWidth={1}
                    opacity={0.9}
                  />
                )}
                {t.playerToken && !isDark && (
                  <text
                    x={x + 20}
                    y={y + h - 15}
                    textAnchor="middle"
                    fill="#000"
                    fontSize={6}
                    fontWeight={900}
                  >
                    P
                  </text>
                )}

                {t.advisorTokens.map((role, i) => (
                  <g key={`${role}-${i}`}>
                    <circle
                      cx={x + 40 + i * 16}
                      cy={y + h - 18}
                      r={5}
                      fill={TOKEN_COLORS[role]}
                      stroke="#000"
                      strokeWidth={0.8}
                      opacity={0.85}
                    />
                    <text
                      x={x + 40 + i * 16}
                      y={y + h - 15}
                      textAnchor="middle"
                      fill="#000"
                      fontSize={5}
                      fontWeight={800}
                    >
                      {role[0].toUpperCase()}
                    </text>
                  </g>
                ))}

                {t.glowState === 'gold' && !isDark && (
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={6}
                    fill="rgba(255,215,0,0.08)"
                    stroke="#ffd700"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
        </svg>

        <div className="relative h-8 rounded-lg overflow-hidden border border-white/[0.08] bg-black/50">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600 via-amber-500/40 to-red-600"
            style={{ width: '100%' }}
          />
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500/90 to-emerald-400/20"
            initial={false}
            animate={{ width: `${bullTerritory}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          />
          <div className="absolute inset-0 flex items-center justify-between px-3 text-[10px] font-black font-mono pointer-events-none">
            <span className="text-emerald-200 drop-shadow-md">
              BULL {bullTerritory.toFixed(0)}%
            </span>
            <span className="text-amber-200 drop-shadow-md">OWL</span>
            <span className="text-red-200 drop-shadow-md">
              BEAR {bearTerritory.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#07080f] p-3">
        <div className="flex items-center gap-2 mb-2">
          <ScrollText className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
            Battle log
          </span>
        </div>
        <div className="max-h-[160px] overflow-y-auto scrollbar-custom space-y-1.5 pr-1">
          {battleLog.length === 0 ? (
            <p className="text-[10px] text-text-muted font-mono py-2">
              No engagements yet — execute orders to shift the front line.
            </p>
          ) : (
            battleLog.map((entry) => (
              <div
                key={entry.id}
                className={`text-[10px] font-mono px-2 py-1.5 rounded border border-white/[0.04] ${
                  entry.tone === 'bull'
                    ? 'text-emerald-300/90 bg-emerald-500/[0.06]'
                    : entry.tone === 'bear'
                      ? 'text-red-300/90 bg-red-500/[0.06]'
                      : entry.tone === 'owl'
                        ? 'text-amber-200/90 bg-amber-500/[0.06]'
                        : 'text-text-secondary bg-white/[0.03]'
                }`}
              >
                <span className="text-text-muted tabular-nums">
                  {new Date(entry.ts).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </span>{' '}
                — {entry.text}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          {
            icon: Trophy,
            label: 'Your P&L',
            value: formatCurrency(sessionPnl),
            color: sessionPnl >= 0 ? '#34d399' : '#f87171',
          },
          {
            icon: Shield,
            label: 'Territory',
            value: `${bullTerritory.toFixed(0)}% bull`,
            color: '#a3e635',
          },
          {
            icon: Target,
            label: 'Consensus acc.',
            value: `${consensusAccuracy.toFixed(0)}%`,
            color: '#fbbf24',
          },
          {
            icon: Eye,
            label: 'Mole intel',
            value: moleExposed ? 'EXPOSED' : `${accusationsRemaining} tries`,
            color: moleExposed ? '#34d399' : '#f87171',
          },
          {
            icon: Swords,
            label: 'Trades',
            value: `${sessionTrades}`,
            color: undefined,
          },
          {
            icon: Flame,
            label: 'Streak',
            value: `${winStreak}W`,
            color: winStreak > 0 ? '#fb923c' : undefined,
          },
          {
            icon: Trophy,
            label: 'Rank',
            value: rankApprox,
            color: '#e8b45e',
          },
          {
            icon: Crosshair,
            label: 'Mole detect.',
            value: `${moleDetection}`,
            color: moleDetection > 0 ? '#34d399' : '#94a3b8',
          },
        ].map((row, i) => (
          <div
            key={i}
            className="glass rounded-xl p-2.5 border border-white/[0.06] text-center"
          >
            <row.icon className="w-3 h-3 mx-auto mb-0.5 text-text-muted" />
            <div className="text-[8px] text-text-muted uppercase tracking-wider">
              {row.label}
            </div>
            <div
              className="text-sm font-mono font-bold tabular-nums mt-0.5"
              style={{
                color: row.color ?? 'var(--color-text-primary, #e2e8f0)',
              }}
            >
              {row.value}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-[9px] font-mono text-text-muted pb-1">
        War score · {score.toFixed(1)} = PnL×0.3 + territory×0.25 +
        mole×0.2 + consensus×0.25
      </div>
    </div>
  );
}
