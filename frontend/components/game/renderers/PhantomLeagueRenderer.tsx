'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sfx } from '@/lib/sounds';
import {
  Ghost,
  TrendingUp,
  TrendingDown,
  Loader2,
  XCircle,
  Rocket,
  Scale,
  Zap,
  Shuffle,
  Anchor,
  Trophy,
  Target,
  BarChart3,
  Sparkles,
  Clock,
} from 'lucide-react';
import { LiveChart } from '@/components/game/shared/LiveChart';
import { SymbolSelector } from '@/components/game/shared/SymbolSelector';
import { RankBadge } from '@/components/game/shared/RankBadge';
import { useTradeStore } from '@/lib/stores/trade-store';
import { useTiltStore } from '@/lib/stores/tilt-store';
import { formatCurrency } from '@/lib/utils/formatters';
import { uniqueId } from '@/lib/utils/unique-id';
import { TILT_ZONE_COLORS } from '@/lib/engines/tilt-detection';
import {
  placeSimulatedTrade,
  sellSimulatedTradeEarly,
  hasActiveSimulation,
} from '@/lib/engines/trade-simulator';
import type { LucideIcon } from 'lucide-react';

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

type ArchetypeKey = 'momentum_rider' | 'mean_reverter' | 'scalper' | 'contrarian' | 'whale';

interface Phantom {
  id: string;
  codename: string;
  archetype: ArchetypeKey;
  revealed: boolean;
  pnl: number;
  tradesCount: number;
  upcomingTrade: { asset: string; direction: 'CALL' | 'PUT' };
}

interface ProfitOrb {
  id: string;
  phantomId: string;
  phantomName: string;
  profit: number;
  spawnedAt: number;
  captured: boolean;
  dissolving: boolean;
}

interface ShadowTrade {
  id: string;
  phantomName: string;
  asset: string;
  direction: 'CALL' | 'PUT';
  profit: number;
  timestamp: number;
}

const PHANTOM_PURPLE = '#8B5CF6';
const SHADOW_PURPLE = '#6D28D9';

const ORB_STYLES = `
@keyframes profit-orb-glow {
  0%, 100% { box-shadow: 0 0 12px rgba(34, 197, 94, 0.4), 0 0 24px rgba(34, 197, 94, 0.15); }
  50% { box-shadow: 0 0 20px rgba(34, 197, 94, 0.6), 0 0 40px rgba(34, 197, 94, 0.25); }
}
@keyframes orb-capture {
  0% { transform: scale(1); opacity: 1; }
  40% { transform: scale(1.4); opacity: 0.8; }
  100% { transform: scale(0); opacity: 0; }
}
@keyframes orb-dissolve {
  0% { transform: scale(1); opacity: 0.8; filter: blur(0); }
  100% { transform: scale(0.3); opacity: 0; filter: blur(8px); }
}
@keyframes orb-countdown {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: 157; }
}
`;

const ARCHETYPE_META: Record<
  ArchetypeKey,
  { label: string; short: string; icon: LucideIcon; accent: string; winRate: number }
> = {
  momentum_rider: {
    label: 'Momentum Rider',
    short: 'Trend follower — buys after sustained moves',
    icon: Rocket,
    accent: '#F59E0B',
    winRate: 0.55,
  },
  mean_reverter: {
    label: 'Mean Reverter',
    short: 'Fades extremes after big candles',
    icon: Scale,
    accent: '#06B6D4',
    winRate: 0.5,
  },
  scalper: {
    label: 'Scalper',
    short: '1m-style scalps, small size, high count',
    icon: Zap,
    accent: '#22C55E',
    winRate: 0.52,
  },
  contrarian: {
    label: 'Contrarian',
    short: 'Against the majority',
    icon: Shuffle,
    accent: '#EC4899',
    winRate: 0.45,
  },
  whale: {
    label: 'Whale',
    short: 'Large notionals, long holds',
    icon: Anchor,
    accent: '#6366F1',
    winRate: 0.48,
  },
};

const DURATION_PRESETS = [
  { label: '1m', value: 1 },
  { label: '5m', value: 5 },
  { label: '15m', value: 15 },
  { label: '1h', value: 60 },
];

const PHANTOM_NAMES = ['Wraith', 'Shade', 'Specter', 'Revenant', 'Umbra', 'Mirage'];
const ARCHETYPE_ORDER: ArchetypeKey[] = [
  'momentum_rider',
  'mean_reverter',
  'scalper',
  'contrarian',
  'whale',
  'momentum_rider',
];

const MAX_VISIBLE_ORBS = 3;
const ORB_LIFETIME_MS = 5000;
const CAPTURE_RATIO = 0.5;

function pickAsset(symbols: string[]): string {
  if (symbols.length === 0) return 'R_100';
  return symbols[Math.floor(Math.random() * symbols.length)] ?? 'R_100';
}

function randomDirection(): 'CALL' | 'PUT' {
  return Math.random() < 0.5 ? 'CALL' : 'PUT';
}

function generateInitialPhantoms(availableAssetSymbols: string[]): Phantom[] {
  return PHANTOM_NAMES.map((name, i) => ({
    id: `phantom-${i}-${name.toLowerCase()}`,
    codename: name,
    archetype: ARCHETYPE_ORDER[i % ARCHETYPE_ORDER.length],
    revealed: false,
    pnl: 0,
    tradesCount: 0,
    upcomingTrade: {
      asset: pickAsset(availableAssetSymbols),
      direction: randomDirection(),
    },
  }));
}

function simulatePhantomTick(p: Phantom, assetPool: string[]): Phantom {
  const meta = ARCHETYPE_META[p.archetype];
  let pnl = p.pnl;
  let trades = p.tradesCount;
  const wr = meta.winRate;

  const applyOne = (scale: number) => {
    const win = Math.random() < wr;
    const magnitude = scale * (8 + Math.random() * 14);
    pnl += win ? magnitude : -magnitude * (0.6 + Math.random() * 0.3);
    trades += 1;
  };

  if (p.archetype === 'scalper') {
    const legs = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < legs; i++) applyOne(0.35);
  } else if (p.archetype === 'whale') {
    applyOne(2.8 + Math.random() * 0.8);
  } else {
    applyOne(1);
  }

  return {
    ...p,
    pnl,
    tradesCount: trades,
    upcomingTrade: {
      asset: pickAsset(assetPool),
      direction: randomDirection(),
    },
  };
}

export default function PhantomLeagueRenderer(props: Props) {
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
    setSelectedDirection,
    setSelectedStake,
    setSelectedDuration,
    availableSymbols,
  } = useTradeStore();

  const { score: tiltScore, zone: tiltZone } = useTiltStore();

  const symbolList = useMemo(
    () => (availableSymbols.length ? availableSymbols.map((s) => s.symbol) : ['R_100', 'R_75', 'R_50']),
    [availableSymbols]
  );

  const [phantoms, setPhantoms] = useState<Phantom[]>(() => generateInitialPhantoms(symbolList));
  const [capturedValue, setCapturedValue] = useState(0);
  const [missedCaptures, setMissedCaptures] = useState(0);
  const [shadowPnl, setShadowPnl] = useState(0);
  const [shadowTrades, setShadowTrades] = useState<ShadowTrade[]>([]);
  const [orbs, setOrbs] = useState<ProfitOrb[]>([]);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  const mountedSymbolsRef = useRef(symbolList);
  const orbIdCounter = useRef(0);
  const activePositionRef = useRef(activePosition);

  useEffect(() => {
    mountedSymbolsRef.current = symbolList;
  }, [symbolList]);

  useEffect(() => {
    activePositionRef.current = activePosition;
  }, [activePosition]);

  const displayName = useTradeStore(
    (s) => s.availableSymbols.find((sym) => sym.symbol === s.selectedAsset)?.display_name
  ) ?? selectedAsset;

  const tiltColor = TILT_ZONE_COLORS[tiltZone];
  const showTiltWarning = tiltScore > 40;
  const isOnTilt = tiltScore > 60;

  const phantomsRevealed = useMemo(() => phantoms.filter((p) => p.revealed).length, [phantoms]);

  const winRatePct = useMemo(() => {
    if (sessionTrades === 0) return 0;
    return Math.round((sessionWins / sessionTrades) * 100);
  }, [sessionTrades, sessionWins]);

  const behavioral = useMemo(() => Math.max(0, 100 - tiltScore), [tiltScore]);

  const score = useMemo(() => {
    return (
      sessionPnl * 0.3 +
      capturedValue * 0.3 +
      phantomsRevealed * 20 +
      behavioral * 0.2
    );
  }, [sessionPnl, capturedValue, phantomsRevealed, behavioral]);

  const playerRank = useMemo(() => {
    const ahead = phantoms.filter((p) => p.pnl > sessionPnl).length;
    return ahead + 1;
  }, [phantoms, sessionPnl]);

  useEffect(() => {
    if (!isLive) return;
    onScoreUpdate({
      score: Math.max(0, score),
      pnl: sessionPnl,
      trades_count: sessionTrades,
      behavioral_score: behavioral,
    });
  }, [isLive, score, sessionPnl, sessionTrades, behavioral, onScoreUpdate]);

  const spawnOrb = useCallback((phantomId: string, phantomName: string, profit: number) => {
    const id = `orb-${orbIdCounter.current++}`;
    setOrbs((prev) => {
      let next = [...prev.filter((o) => !o.captured && !o.dissolving)];
      if (next.length >= MAX_VISIBLE_ORBS) {
        const oldest = next[0];
        if (oldest) {
          next = next.slice(1);
          setMissedCaptures((c) => c + 1);
        }
      }
      return [...next, { id, phantomId, phantomName, profit, spawnedAt: Date.now(), captured: false, dissolving: false }];
    });
  }, []);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setOrbs((prev) => {
        let missed = 0;
        const next = prev.map((orb) => {
          if (orb.captured || orb.dissolving) return orb;
          if (now - orb.spawnedAt >= ORB_LIFETIME_MS) {
            missed++;
            return { ...orb, dissolving: true };
          }
          return orb;
        });
        if (missed > 0) setMissedCaptures((c) => c + missed);
        return next.filter((o) => !(o.dissolving && now - o.spawnedAt >= ORB_LIFETIME_MS + 800));
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isLive]);

  useEffect(() => {
    if (!isLive) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const syms = mountedSymbolsRef.current;
      const playerIsTrading = !!activePositionRef.current;

      setPhantoms((prev) => {
        return prev.map((p) => {
          const oldPnl = p.pnl;
          const updated = simulatePhantomTick(p, syms.length ? syms : ['R_100']);
          const tradePnlDelta = updated.pnl - oldPnl;

          if (tradePnlDelta > 0) {
            if (!playerIsTrading) {
              setShadowPnl((s) => s + tradePnlDelta);
            }
            setShadowTrades((st) => {
              const entry: ShadowTrade = {
                id: uniqueId(`st-${p.id}`),
                phantomName: p.revealed ? p.codename : '???',
                asset: p.upcomingTrade.asset,
                direction: p.upcomingTrade.direction,
                profit: tradePnlDelta,
                timestamp: Date.now(),
              };
              if (st.some((existing) => existing.id === entry.id)) {
                if (process.env.NODE_ENV !== 'production') {
                  console.debug('[PhantomLeague] dropped duplicate shadow-trade id', entry.id);
                }
                return st;
              }
              return [entry, ...st].slice(0, 5);
            });
            spawnOrb(p.id, p.revealed ? p.codename : '???', tradePnlDelta);
          }

          return updated;
        });
      });

      timeoutId = setTimeout(tick, 5000 + Math.random() * 5000);
    };

    timeoutId = setTimeout(tick, 4000 + Math.random() * 4000);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isLive, spawnOrb]);

  const captureOrb = useCallback((orbId: string) => {
    sfx.play('orb_capture');
    setOrbs((prev) =>
      prev.map((o) => {
        if (o.id !== orbId || o.captured || o.dissolving) return o;
        setCapturedValue((v) => v + o.profit * CAPTURE_RATIO);
        setPhantoms((phantomsPrev) =>
          phantomsPrev.map((p) =>
            p.id === o.phantomId && !p.revealed ? { ...p, revealed: true } : p
          )
        );
        return { ...o, captured: true };
      })
    );
  }, []);

  const handlePlaceTrade = async () => {
    if (!isLive || isPlacingTrade || hasActiveSimulation()) return;
    sfx.play('trade_place');
    setIsPlacingTrade(true);
    setTradeError(null);

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
    }
    setIsPlacingTrade(false);
  };

  const pnlPositive = sessionPnl >= 0;

  const liveMarketPanel = (
    <div className="flex flex-col min-h-0 flex-1">
      <div
        className="px-3 py-2 flex items-center gap-2 border-b shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(16,185,129,0.04)' }}
      >
        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          Live Market
        </span>
      </div>

      <div className="border-b border-white/[0.06]">
        <LiveChart height={180} compact />
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-3">
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
                className="p-3 rounded-xl border"
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
                  <span className="text-sm font-semibold text-text-primary">{activePosition.asset}</span>
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
                    <div className="text-[10px] text-text-muted">Live P&L</div>
                    <div
                      className={`text-xl font-black tabular-nums font-mono ${
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
                    <Clock className="w-2.5 h-2.5" /> Contract running
                  </span>
                  <span className="font-mono">SIM</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: PHANTOM_PURPLE }}
                    animate={{ width: ['0%', '100%'] }}
                    transition={{ duration: selectedDuration * 60, ease: 'linear' }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => sellSimulatedTradeEarly()}
                className="w-full h-9 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/5 transition-all flex items-center justify-center gap-2"
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
              className="space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5" style={{ color: PHANTOM_PURPLE }} />
                  <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
                    Trade ticket
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded text-[8px] font-bold border"
                    style={{
                      color: PHANTOM_PURPLE,
                      borderColor: `${PHANTOM_PURPLE}35`,
                      background: `${PHANTOM_PURPLE}12`,
                    }}
                  >
                    SIM
                  </span>
                </div>
              </div>

              <SymbolSelector compact />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDirection('CALL')}
                  className={`flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-bold transition-all border ${
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
                  className={`flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-bold transition-all border ${
                    selectedDirection === 'PUT'
                      ? 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]'
                      : 'bg-white/[0.03] border-white/[0.08] text-text-muted hover:text-text-secondary'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  FALL
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-text-muted uppercase tracking-wider mb-1 block font-mono">
                    Stake (USD)
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="number"
                      value={selectedStake}
                      onChange={(e) => setSelectedStake(Number(e.target.value))}
                      min={1}
                      max={1000}
                      className="flex-1 h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:outline-none focus:border-purple-500/35 text-xs text-text-primary tabular-nums font-mono"
                    />
                    {[10, 25, 50].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSelectedStake(preset)}
                        className={`px-1.5 h-8 rounded-lg text-[9px] font-bold transition-all border ${
                          selectedStake === preset
                            ? 'border-purple-500/40 text-purple-300 bg-purple-500/10'
                            : 'border-white/[0.08] text-text-muted hover:text-text-secondary'
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[9px] text-text-muted uppercase tracking-wider mb-1 block font-mono">
                    Duration
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {DURATION_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setSelectedDuration(preset.value)}
                        className={`h-8 rounded-lg text-[9px] font-bold transition-all border ${
                          selectedDuration === preset.value
                            ? 'border-purple-500/40 text-purple-300 bg-purple-500/10'
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
                className="w-full h-11 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-white disabled:opacity-40"
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
                    Simulate trade · {formatCurrency(selectedStake)}
                  </>
                )}
              </button>

              {showTiltWarning && (
                <div
                  className="flex items-center gap-2 text-[10px] rounded-lg px-3 py-1.5 border"
                  style={{
                    color: tiltColor,
                    borderColor: `${tiltColor}25`,
                    background: `${tiltColor}08`,
                  }}
                >
                  <Zap className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
                  <span className="font-mono">
                    Tilt {tiltScore}/100 — size and timing matter more here.
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-2 border-t border-white/[0.06]">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-text-muted font-mono">Session P&L</span>
            <span className={`font-mono font-bold tabular-nums ${pnlPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(sessionPnl)}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] mt-1">
            <span className="text-text-muted font-mono">Captured</span>
            <span className="font-mono font-bold tabular-nums text-purple-300">
              {formatCurrency(capturedValue)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const shadowMarketPanel = (
    <div className="flex flex-col min-h-0 flex-1" style={{ opacity: 0.92 }}>
      <div
        className="px-3 py-2 flex items-center gap-2 border-b shrink-0"
        style={{ borderColor: `${SHADOW_PURPLE}30`, background: `${SHADOW_PURPLE}08` }}
      >
        <Ghost className="w-3.5 h-3.5" style={{ color: SHADOW_PURPLE }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: SHADOW_PURPLE }}>
          Shadow Market
        </span>
      </div>

      <div className="p-3 flex-1 overflow-y-auto space-y-3">
        <div
          className="rounded-xl p-3 border shrink-0"
          style={{ borderColor: `${SHADOW_PURPLE}20`, background: `${SHADOW_PURPLE}06` }}
        >
          <div className="text-[9px] font-mono uppercase tracking-wider text-text-muted mb-1">
            Missed opportunity P&L
          </div>
          <div
            className="text-2xl font-black tabular-nums font-mono"
            style={{ color: shadowPnl >= 0 ? `${SHADOW_PURPLE}` : '#f87171' }}
          >
            {formatCurrency(shadowPnl)}
          </div>
          <div className="text-[9px] text-text-muted mt-1 font-mono">
            {shadowTrades.length} phantom wins you missed
          </div>
        </div>

        <div className="shrink-0">
          <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" style={{ color: SHADOW_PURPLE }} />
            Profit Orbs
          </div>
          <div className="relative min-h-[100px] rounded-xl border p-3 flex items-center justify-center gap-3 flex-wrap"
            style={{ borderColor: `${SHADOW_PURPLE}15`, background: 'rgba(0,0,0,0.3)' }}
          >
            <AnimatePresence>
              {orbs.filter((o) => !o.captured || Date.now() - o.spawnedAt < 500).map((orb) => (
                <motion.button
                  key={orb.id}
                  type="button"
                  onClick={() => captureOrb(orb.id)}
                  disabled={orb.captured || orb.dissolving}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={
                    orb.captured
                      ? { scale: 0, opacity: 0 }
                      : orb.dissolving
                        ? { scale: 0.3, opacity: 0, filter: 'blur(8px)' }
                        : { scale: 1, opacity: 1 }
                  }
                  exit={{ scale: 0, opacity: 0 }}
                  transition={
                    orb.captured
                      ? { duration: 0.4, ease: 'easeOut' }
                      : orb.dissolving
                        ? { duration: 0.8, ease: 'easeOut' }
                        : { type: 'spring', stiffness: 300, damping: 20 }
                  }
                  className="relative w-16 h-16 rounded-full flex flex-col items-center justify-center cursor-pointer select-none border-2 border-emerald-400/40 shrink-0"
                  style={{
                    background: 'radial-gradient(circle, rgba(34,197,94,0.25) 0%, rgba(34,197,94,0.05) 70%)',
                    animation: !orb.captured && !orb.dissolving ? 'profit-orb-glow 1s infinite' : undefined,
                  }}
                >
                  <span className="text-[10px] font-black text-emerald-300 tabular-nums font-mono">
                    +{formatCurrency(orb.profit * CAPTURE_RATIO)}
                  </span>
                  <span className="text-[7px] text-emerald-400/70 font-mono mt-0.5">
                    {orb.phantomName}
                  </span>
                  {!orb.captured && !orb.dissolving && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                      <circle
                        cx="28" cy="28" r="25"
                        fill="none"
                        stroke="rgba(34,197,94,0.3)"
                        strokeWidth="2"
                        strokeDasharray="157"
                        style={{
                          animation: `orb-countdown ${ORB_LIFETIME_MS}ms linear forwards`,
                          animationDelay: `${-(Date.now() - orb.spawnedAt)}ms`,
                        }}
                      />
                    </svg>
                  )}
                </motion.button>
              ))}
            </AnimatePresence>
            {orbs.filter((o) => !o.captured && !o.dissolving).length === 0 && (
              <div className="text-[10px] text-text-muted/50 font-mono text-center">
                Waiting for phantom profits…
              </div>
            )}
          </div>
          {missedCaptures > 0 && (
            <div className="text-[9px] text-red-400/60 font-mono mt-1 text-right">
              {missedCaptures} orb{missedCaptures > 1 ? 's' : ''} dissolved
            </div>
          )}
        </div>

        <div className="shrink-0">
          <div className="text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2">
            Recent phantom trades
          </div>
          <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
            {shadowTrades.length === 0 && (
              <div className="text-[9px] text-text-muted/50 font-mono">No trades yet</div>
            )}
            {shadowTrades.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between rounded-lg px-2.5 py-1.5 border text-[10px] font-mono"
                style={{ borderColor: `${SHADOW_PURPLE}15`, background: `${SHADOW_PURPLE}05` }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-text-muted truncate">{t.phantomName}</span>
                  <span className={t.direction === 'CALL' ? 'text-emerald-400/70' : 'text-red-400/70'}>
                    {t.direction === 'CALL' ? '↑' : '↓'}
                  </span>
                  <span className="text-text-muted/60 truncate">{t.asset}</span>
                </div>
                <span className="text-emerald-400/80 tabular-nums font-bold shrink-0">
                  +{formatCurrency(t.profit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-0" data-instance={instanceId} data-user={userId}>
      <style dangerouslySetInnerHTML={{ __html: ORB_STYLES }} />

      <div
        className="rounded-t-2xl border border-white/[0.06] p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(10,10,18,0.95) 45%)',
          boxShadow: `inset 0 0 40px ${PHANTOM_PURPLE}12`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Ghost className="w-4 h-4" style={{ color: PHANTOM_PURPLE }} />
              <span
                className="text-[10px] font-mono uppercase tracking-widest font-bold"
                style={{ color: PHANTOM_PURPLE }}
              >
                Phantom Hunt
              </span>
            </div>
            <p className="text-xs text-text-muted max-w-[280px]">
              Trade the live market. Capture phantom profit orbs from the shadow side before they dissolve.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <RankBadge size="sm" showXp />
            <div
              className="text-[9px] font-mono px-2 py-0.5 rounded-full border"
              style={{
                borderColor: `${PHANTOM_PURPLE}40`,
                color: PHANTOM_PURPLE,
                background: `${PHANTOM_PURPLE}12`,
              }}
            >
              Rank #{playerRank}
            </div>
          </div>
        </div>
      </div>

      <div className="border-x border-white/[0.06] bg-[rgba(8,8,14,0.6)] p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" style={{ color: PHANTOM_PURPLE }} />
            Phantom grid
          </span>
          <span className="text-[9px] font-mono text-text-muted">
            {phantomsRevealed}/{phantoms.length} revealed
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {phantoms.map((p) => {
            const meta = ARCHETYPE_META[p.archetype];
            const Icon = meta.icon;

            return (
              <div
                key={p.id}
                className="text-left rounded-xl border p-2.5 relative overflow-hidden"
                style={{
                  borderColor: p.revealed ? `${meta.accent}55` : 'rgba(255,255,255,0.08)',
                  background: p.revealed ? `${meta.accent}10` : 'rgba(255,255,255,0.02)',
                  boxShadow: p.revealed ? `0 0 24px ${meta.accent}28` : undefined,
                }}
              >
                <div
                  className={`flex items-start gap-2 ${!p.revealed ? 'blur-sm select-none' : ''}`}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border"
                    style={{
                      borderColor: `${meta.accent}40`,
                      background: `${meta.accent}18`,
                      color: meta.accent,
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold font-mono text-text-primary truncate">
                      {p.revealed ? p.codename : '???'}
                    </div>
                    <div className="text-[9px] text-text-muted leading-tight line-clamp-2">
                      {p.revealed ? meta.label : 'Unknown archetype'}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-[10px] font-mono text-text-muted">
                    Trades{' '}
                    <span className="text-text-secondary tabular-nums">{p.tradesCount}</span>
                  </div>
                  <div
                    className={`text-xs font-mono font-bold tabular-nums ${
                      p.revealed ? '' : 'text-text-muted'
                    }`}
                    style={
                      p.revealed
                        ? { color: p.pnl >= 0 ? '#34d399' : '#f87171' }
                        : undefined
                    }
                  >
                    {p.revealed ? formatCurrency(p.pnl) : '••••'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isLive ? (
        <div
          className="border-x border-b border-white/[0.06] rounded-b-2xl overflow-hidden flex"
          style={{ background: 'rgba(10,10,18,0.95)', minHeight: 420 }}
        >
          <div className="flex flex-col" style={{ width: '55%' }}>
            {liveMarketPanel}
          </div>

          <div
            className="w-px self-stretch shrink-0"
            style={{
              background: `linear-gradient(180deg, ${SHADOW_PURPLE}00, ${SHADOW_PURPLE}60, ${SHADOW_PURPLE}00)`,
              boxShadow: `0 0 8px ${SHADOW_PURPLE}40`,
            }}
          />

          <div className="flex flex-col" style={{ width: '45%' }}>
            {shadowMarketPanel}
          </div>
        </div>
      ) : (
        <div className="border-x border-b border-white/[0.06] rounded-b-2xl">
          <LiveChart height={200} compact />
        </div>
      )}

      <div className="mt-3 rounded-2xl border border-white/[0.06] overflow-hidden">
        <div
          className="px-3 py-2 flex items-center gap-2 border-b border-white/[0.06]"
          style={{ background: `${PHANTOM_PURPLE}10` }}
        >
          <Trophy className="w-4 h-4" style={{ color: PHANTOM_PURPLE }} />
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-primary">Leaderboard</span>
        </div>
        <ul className="divide-y divide-white/[0.05] max-h-[220px] overflow-y-auto">
          {[
            { id: 'you', label: 'You', pnl: sessionPnl, isPlayer: true as const },
            ...phantoms.map((p) => ({
              id: p.id,
              label: p.revealed ? p.codename : '???',
              pnl: p.pnl,
              isPlayer: false as const,
              accent: ARCHETYPE_META[p.archetype].accent,
              revealed: p.revealed,
            })),
          ]
            .sort((a, b) => b.pnl - a.pnl)
            .map((row, idx) => (
              <li
                key={row.id}
                className={`flex items-center justify-between px-3 py-2 text-xs font-mono ${
                  'isPlayer' in row && row.isPlayer ? 'bg-white/[0.04]' : ''
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-text-muted w-5 shrink-0">#{idx + 1}</span>
                  <span
                    className={`truncate font-bold ${'isPlayer' in row && row.isPlayer ? 'text-purple-300' : 'text-text-primary'}`}
                    style={
                      !('isPlayer' in row && row.isPlayer) && 'accent' in row && row.revealed
                        ? { color: row.accent }
                        : undefined
                    }
                  >
                    {row.label}
                  </span>
                  {'isPlayer' in row && row.isPlayer && (
                    <span className="text-[9px] px-1.5 py-0 rounded border border-purple-500/30 text-purple-300">
                      live
                    </span>
                  )}
                </div>
                <span
                  className={`tabular-nums shrink-0 ${row.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {formatCurrency(row.pnl)}
                </span>
              </li>
            ))}
        </ul>
      </div>

      <div className="relative mt-3">
        <div
          className="absolute inset-0 pointer-events-none rounded-2xl z-0"
          style={{
            background:
              pnlPositive && sessionTrades > 0
                ? 'linear-gradient(90deg, rgba(16,185,129,0.06) 0%, transparent 35%)'
                : !pnlPositive && sessionTrades > 0
                  ? 'linear-gradient(90deg, transparent 65%, rgba(239,68,68,0.06) 100%)'
                  : 'none',
          }}
        />
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {[
            { icon: TrendingUp, label: 'Your P&L', value: formatCurrency(sessionPnl), color: pnlPositive ? '#10b981' : '#ef4444' },
            { icon: Ghost, label: 'Phantoms revealed', value: String(phantomsRevealed), color: PHANTOM_PURPLE },
            { icon: Target, label: 'Orbs captured', value: formatCurrency(capturedValue), color: '#22c55e' },
            { icon: BarChart3, label: 'Win rate', value: `${winRatePct}%`, color: winRatePct >= 50 ? '#10b981' : '#ef4444' },
            { icon: Zap, label: 'Trades', value: String(sessionTrades), color: '#94a3b8' },
            {
              icon: Trophy,
              label: 'Rank',
              value: `#${playerRank} / ${phantoms.length + 1}`,
              color: PHANTOM_PURPLE,
            },
          ].map((stat, i) => (
            <div key={i} className="glass rounded-xl p-2.5 text-center border border-white/[0.06]">
              <stat.icon className="w-3.5 h-3.5 mx-auto mb-1 text-text-muted" />
              <div className="text-[8px] text-text-muted uppercase tracking-wider">{stat.label}</div>
              <div className="text-sm font-mono font-bold tabular-nums mt-0.5" style={{ color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
