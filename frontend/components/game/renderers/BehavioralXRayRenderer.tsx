'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sfx } from '@/lib/sounds';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  XCircle,
  Brain,
  Activity,
  Target,
  BarChart3,
} from 'lucide-react';
import { LiveChart } from '@/components/game/shared/LiveChart';
import { SymbolSelector } from '@/components/game/shared/SymbolSelector';
import { RankBadge } from '@/components/game/shared/RankBadge';
import { useTradeStore } from '@/lib/stores/trade-store';
import { useTiltStore } from '@/lib/stores/tilt-store';
import { formatCurrency } from '@/lib/utils/formatters';
import type { Trade } from '@/lib/db/schema';
import {
  placeSimulatedTrade,
  sellSimulatedTradeEarly,
  hasActiveSimulation,
} from '@/lib/engines/trade-simulator';
import {
  getHeartRate,
  getHeartRateColor,
  getHeartRateAnimDuration,
  shouldShowHallucinations,
  getHallucinationIntensity,
  generateFakeAlert,
  getPriceFlicker,
  type FakeAlert,
} from '@/lib/engines/hallucination-engine';

const KEYFRAMES_CSS = `
@keyframes heartbeat-border {
  0%, 100% { border-color: var(--hb-color); box-shadow: 0 0 8px var(--hb-glow); }
  50% { border-color: transparent; box-shadow: 0 0 0px transparent; }
}
@keyframes ecg-line {
  0% { stroke-dashoffset: 80; }
  100% { stroke-dashoffset: 0; }
}
@keyframes hallucination-fade {
  0% { opacity: 0; transform: translateX(20px); }
  10% { opacity: 1; transform: translateX(0); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-8px); }
}
@keyframes clarity-restored {
  0% { opacity: 1; background: rgba(34,197,94,0.2); }
  100% { opacity: 0; background: rgba(34,197,94,0); }
}
`;

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

type DimensionKey = 'discipline' | 'patience' | 'riskManagement' | 'emotionalControl' | 'consistency';

interface DimensionScores {
  discipline: number;
  patience: number;
  riskManagement: number;
  emotionalControl: number;
  consistency: number;
}

type FlagTone = 'positive' | 'warning' | 'violation';

interface BehavioralFlag {
  id: string;
  label: string;
  tone: FlagTone;
}

interface TaggedTradeRow {
  id: string;
  asset: string;
  direction: 'CALL' | 'PUT';
  stake: number;
  pnl: number;
  tags: BehavioralFlag[];
  closedAt: number;
}

const DURATION_PRESETS = [
  { label: '1m', value: 1, unit: 'm' },
  { label: '5m', value: 5, unit: 'm' },
  { label: '15m', value: 15, unit: 'm' },
  { label: '1h', value: 60, unit: 'm' },
];

const DIMENSION_LABELS: { key: DimensionKey; label: string }[] = [
  { key: 'discipline', label: 'Discipline' },
  { key: 'patience', label: 'Patience' },
  { key: 'riskManagement', label: 'Risk Mgmt' },
  { key: 'emotionalControl', label: 'Emotion' },
  { key: 'consistency', label: 'Consistency' },
];

const INITIAL_DIMENSIONS: DimensionScores = {
  discipline: 72,
  patience: 72,
  riskManagement: 72,
  emotionalControl: 72,
  consistency: 72,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function besFromDimensions(d: DimensionScores): number {
  return (
    (d.discipline +
      d.patience +
      d.riskManagement +
      d.emotionalControl +
      d.consistency) /
    5
  );
}

function gradientForValue(v: number): string {
  const t = clamp(v, 0, 100) / 100;
  if (t < 0.5) {
    const k = t / 0.5;
    const r = Math.round(239 + (245 - 239) * k);
    const g = Math.round(68 + (158 - 68) * k);
    const b = Math.round(68 + (11 - 68) * k);
    return `rgb(${r},${g},${b})`;
  }
  const k = (t - 0.5) / 0.5;
  const r = Math.round(245 + (34 - 245) * k);
  const g = Math.round(158 + (197 - 158) * k);
  const b = Math.round(11 + (94 - 11) * k);
  return `rgb(${r},${g},${b})`;
}

export default function BehavioralXRayRenderer(props: Props) {
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
    tradeHistory,
    setSelectedDirection,
    setSelectedStake,
    setSelectedDuration,
  } = useTradeStore();

  const { score: tiltScore, zone: tiltZone } = useTiltStore();

  const [dimensions, setDimensions] = useState<DimensionScores>(INITIAL_DIMENSIONS);
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [recentFlagBatches, setRecentFlagBatches] = useState<
    { tradeId: string; flags: BehavioralFlag[] }[]
  >([]);
  const [taggedTrades, setTaggedTrades] = useState<TaggedTradeRow[]>([]);
  const [fakeAlerts, setFakeAlerts] = useState<FakeAlert[]>([]);
  const [hallucinationResistance, setHallucinationResistance] = useState(0);
  const [showClarityFlash, setShowClarityFlash] = useState(false);
  const [flickerValue, setFlickerValue] = useState<number | null>(null);

  const prevSessionTradesRef = useRef(sessionTrades);
  const prevInstanceRef = useRef(instanceId);
  const dimensionsRef = useRef<DimensionScores>(INITIAL_DIMENSIONS);
  const wasHallucinatingRef = useRef(false);
  const hallucinationResistanceRef = useRef(0);

  const traceRef = useRef({
    prevEntryTime: null as number | null,
    prevPnl: null as number | null,
    prevStake: null as number | null,
    prevAsset: null as string | null,
    prevDirection: null as 'CALL' | 'PUT' | null,
    recentStakes: [] as number[],
    recentAssets: [] as string[],
  });

  const displayName =
    useTradeStore((s) => s.availableSymbols.find((sym) => sym.symbol === s.selectedAsset)?.display_name) ??
    selectedAsset;

  const bes = useMemo(() => besFromDimensions(dimensions), [dimensions]);
  const heartRate = getHeartRate(bes);
  const heartRateColor = getHeartRateColor(bes);
  const heartRateAnimDur = getHeartRateAnimDuration(heartRate);
  const hallucinationsActive = shouldShowHallucinations(bes);
  const hallucinationIntensity = getHallucinationIntensity(bes);

  const bestWorst = useMemo(() => {
    const entries = DIMENSION_LABELS.map(({ key, label }) => ({
      key,
      label,
      value: dimensions[key],
    }));
    const sorted = [...entries].sort((a, b) => b.value - a.value);
    return {
      best: sorted[0]?.label ?? '—',
      worst: sorted[sorted.length - 1]?.label ?? '—',
    };
  }, [dimensions]);

  useEffect(() => {
    if (!hallucinationsActive && wasHallucinatingRef.current && bes >= 50) {
      setShowClarityFlash(true);
      const t = setTimeout(() => setShowClarityFlash(false), 1000);
      return () => clearTimeout(t);
    }
    wasHallucinatingRef.current = hallucinationsActive;
  }, [hallucinationsActive, bes]);

  useEffect(() => {
    if (!hallucinationsActive) return;

    const spawnAlert = () => {
      const alert = generateFakeAlert(hallucinationIntensity);
      if (alert) {
        setFakeAlerts((prev) => [...prev, alert].slice(-3));
        setTimeout(() => {
          setFakeAlerts((prev) => prev.filter((a) => a.id !== alert.id));
        }, 4000);
      }
    };

    const delay = 3000 + Math.random() * 2000;
    const iv = setInterval(spawnAlert, delay);
    spawnAlert();
    return () => clearInterval(iv);
  }, [hallucinationsActive, hallucinationIntensity]);

  useEffect(() => {
    if (!hallucinationsActive) return;

    const iv = setInterval(() => {
      const flicker = getPriceFlicker(bes, hallucinationIntensity);
      if (flicker !== null) {
        setFlickerValue(flicker);
        setTimeout(() => setFlickerValue(null), 100);
      }
    }, 800);

    return () => clearInterval(iv);
  }, [hallucinationsActive, hallucinationIntensity, bes]);

  const resetTrace = useCallback(() => {
    traceRef.current = {
      prevEntryTime: null,
      prevPnl: null,
      prevStake: null,
      prevAsset: null,
      prevDirection: null,
      recentStakes: [],
      recentAssets: [],
    };
    setDimensions(INITIAL_DIMENSIONS);
    dimensionsRef.current = INITIAL_DIMENSIONS;
    setRecentFlagBatches([]);
    setTaggedTrades([]);
    setFakeAlerts([]);
    setHallucinationResistance(0);
    hallucinationResistanceRef.current = 0;
    wasHallucinatingRef.current = false;
    prevSessionTradesRef.current = useTradeStore.getState().sessionTrades;
  }, []);

  useEffect(() => {
    if (instanceId !== prevInstanceRef.current) {
      prevInstanceRef.current = instanceId;
      resetTrace();
    }
  }, [instanceId, resetTrace]);

  const analyzeCompletedTrade = useCallback(
    (trade: Trade) => {
      const pnlSession = useTradeStore.getState().sessionPnl;

      const nowEntry = trade.timestamp;
      const tr = traceRef.current;
      const timeSinceLast =
        tr.prevEntryTime !== null ? nowEntry - tr.prevEntryTime : null;

      const flags: BehavioralFlag[] = [];
      const stake = trade.stake;
      const pnl = trade.pnl ?? 0;

      const medianStake = (() => {
        const arr = [...tr.recentStakes, stake].slice(-5);
        if (arr.length === 0) return stake;
        const s = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
      })();

      if (timeSinceLast !== null) {
        if (timeSinceLast >= 30_000) {
          flags.push({ id: 'patience_good', label: 'Good patience', tone: 'positive' });
        } else if (timeSinceLast < 10_000) {
          flags.push({ id: 'patience_poor', label: 'Rapid re-entry (<10s)', tone: 'violation' });
        } else {
          flags.push({ id: 'patience_ok', label: 'Moderate cadence', tone: 'warning' });
        }
      }

      const lossBefore = tr.prevPnl !== null && tr.prevPnl < 0;
      const quickAfterLoss =
        lossBefore && timeSinceLast !== null && timeSinceLast < 25_000;
      if (quickAfterLoss) {
        flags.push({
          id: 'revenge',
          label: 'Revenge trade detected',
          tone: 'violation',
        });
      } else if (lossBefore && timeSinceLast !== null && timeSinceLast >= 60_000) {
        flags.push({
          id: 'cooldown',
          label: 'Cooled down after loss',
          tone: 'positive',
        });
      }

      if (
        tr.prevStake !== null &&
        lossBefore &&
        stake > tr.prevStake * 1.2
      ) {
        flags.push({
          id: 'escalate',
          label: 'Stake escalation after loss',
          tone: 'violation',
        });
      } else if (
        tr.prevStake !== null &&
        Math.abs(stake - medianStake) / Math.max(medianStake, 1) < 0.12
      ) {
        flags.push({
          id: 'sizing',
          label: 'Disciplined sizing',
          tone: 'positive',
        });
      }

      if (tr.prevAsset !== null && trade.asset !== tr.prevAsset) {
        flags.push({
          id: 'asset_switch',
          label: 'Asset switch',
          tone: 'warning',
        });
      }
      if (
        tr.prevDirection !== null &&
        trade.direction !== tr.prevDirection &&
        timeSinceLast !== null &&
        timeSinceLast < 45_000
      ) {
        flags.push({
          id: 'direction_flip',
          label: 'Quick direction flip',
          tone: 'warning',
        });
      }

      const recentAssets = [...tr.recentAssets, trade.asset].slice(-5);
      const uniqueAssets = new Set(recentAssets).size;
      if (recentAssets.length >= 4 && uniqueAssets >= 3) {
        flags.push({
          id: 'erratic_universe',
          label: 'Erratic asset hopping',
          tone: 'warning',
        });
      }

      const stakesRoll = [...tr.recentStakes, stake].slice(-4);
      const stakeSpread =
        stakesRoll.length > 1
          ? Math.max(...stakesRoll) - Math.min(...stakesRoll)
          : 0;
      if (stakesRoll.length >= 3 && stakeSpread > medianStake * 0.5) {
        flags.push({
          id: 'stake_chaos',
          label: 'Inconsistent stakes',
          tone: 'warning',
        });
      }

      if (pnlSession < -40 && stake > medianStake * 1.35) {
        flags.push({
          id: 'risk_down',
          label: 'Oversized while underwater',
          tone: 'violation',
        });
      } else if (pnlSession > 20 && stake <= medianStake * 1.1) {
        flags.push({
          id: 'risk_ok',
          label: 'Sizing respects edge',
          tone: 'positive',
        });
      }

      if (tiltScore > 55 && quickAfterLoss) {
        flags.push({
          id: 'tilt_stack',
          label: `Tilt zone (${tiltZone}) — high risk`,
          tone: 'violation',
        });
      }

      if (flags.length === 0) {
        flags.push({
          id: 'neutral',
          label: 'Clean execution',
          tone: 'positive',
        });
      }

      const prev = dimensionsRef.current;
      const d = { ...prev };

      if (timeSinceLast !== null) {
        if (timeSinceLast >= 30_000) d.patience = clamp(d.patience + 6, 0, 100);
        else if (timeSinceLast < 10_000) d.patience = clamp(d.patience - 12, 0, 100);
        else d.patience = clamp(d.patience + 2, 0, 100);
      }

      if (stakesRoll.length >= 3 && stakeSpread <= medianStake * 0.25) {
        d.discipline = clamp(d.discipline + 5, 0, 100);
      } else if (stakeSpread > medianStake * 0.55) {
        d.discipline = clamp(d.discipline - 6, 0, 100);
      }

      if (quickAfterLoss) {
        d.emotionalControl = clamp(d.emotionalControl - 14, 0, 100);
      } else if (lossBefore && timeSinceLast !== null && timeSinceLast >= 60_000) {
        d.emotionalControl = clamp(d.emotionalControl + 5, 0, 100);
      } else if (trade.status === 'won' && !lossBefore) {
        d.emotionalControl = clamp(d.emotionalControl + 3, 0, 100);
      }

      if (pnlSession < -30 && stake > medianStake * 1.4) {
        d.riskManagement = clamp(d.riskManagement - 12, 0, 100);
      } else if (Math.abs(stake - medianStake) / Math.max(medianStake, 1) < 0.15) {
        d.riskManagement = clamp(d.riskManagement + 4, 0, 100);
      }

      if (trade.asset === tr.prevAsset && tr.prevAsset !== null) {
        d.consistency = clamp(d.consistency + 4, 0, 100);
      } else {
        d.consistency = clamp(d.consistency - 5, 0, 100);
      }
      if (uniqueAssets >= 4) {
        d.consistency = clamp(d.consistency - 8, 0, 100);
      }

      dimensionsRef.current = d;
      setDimensions(d);

      const currentBes = besFromDimensions(d);
      const wasHallucinating = shouldShowHallucinations(currentBes);
      if (wasHallucinating && pnl > 0) {
        hallucinationResistanceRef.current += 1;
        setHallucinationResistance(hallucinationResistanceRef.current);
      }

      const st = useTradeStore.getState();
      const hr = hallucinationResistanceRef.current;
      if (isLive) {
        onScoreUpdate({
          score: Math.max(0, currentBes * 0.5 + st.sessionPnl * 0.2 + hr * 15),
          pnl: st.sessionPnl,
          trades_count: st.sessionTrades,
          behavioral_score: currentBes,
        });
      }

      traceRef.current = {
        prevEntryTime: nowEntry,
        prevPnl: pnl,
        prevStake: stake,
        prevAsset: trade.asset,
        prevDirection: trade.direction,
        recentStakes: [...tr.recentStakes, stake].slice(-8),
        recentAssets,
      };

      setRecentFlagBatches((b) =>
        [{ tradeId: trade.id, flags }, ...b].slice(0, 5)
      );

      setTaggedTrades((rows) =>
        [
          {
            id: trade.id,
            asset: trade.asset,
            direction: trade.direction,
            stake,
            pnl,
            tags: flags.slice(0, 6),
            closedAt: trade.closedAt ?? Date.now(),
          },
          ...rows,
        ].slice(0, 5)
      );
    },
    [tiltScore, tiltZone, isLive, onScoreUpdate]
  );

  useEffect(() => {
    if (sessionTrades <= prevSessionTradesRef.current) return;
    prevSessionTradesRef.current = sessionTrades;

    const completed = tradeHistory
      .filter((t) => t.status === 'won' || t.status === 'lost')
      .sort((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0));
    const latest = completed[0];
    if (latest) {
      analyzeCompletedTrade(latest);
    }
  }, [sessionTrades, tradeHistory, analyzeCompletedTrade]);

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

  const gaugeR = 52;
  const gaugeC = 2 * Math.PI * gaugeR;
  const besArc = (bes / 100) * gaugeC;
  const displayBes = flickerValue !== null ? flickerValue : bes;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES_CSS }} />
      <div
        className="space-y-4 relative rounded-2xl border-2 p-1"
        data-instance={instanceId}
        data-user={userId}
        style={{
          '--hb-color': heartRateColor,
          '--hb-glow': `${heartRateColor}66`,
          animation: `heartbeat-border ${heartRateAnimDur}s ease-in-out infinite`,
          borderColor: heartRateColor,
        } as React.CSSProperties}
      >
        {hallucinationsActive && (
          <div className="absolute top-2 left-2 z-30 px-1.5 py-0.5 rounded-full border border-red-500/30 bg-purple-500/10">
            <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-red-400/90">
              Hallucination Warning
            </span>
          </div>
        )}

        {showClarityFlash && (
          <div
            className="absolute inset-0 z-20 rounded-2xl flex items-center justify-center pointer-events-none"
            style={{ animation: 'clarity-restored 1s forwards' }}
          >
            <span className="text-sm font-mono font-black text-emerald-400 tracking-widest uppercase">
              Clarity Restored
            </span>
          </div>
        )}

        <div className="absolute top-2 right-2 z-30 flex flex-col items-end gap-1.5 pointer-events-none" style={{ maxWidth: '220px' }}>
          <AnimatePresence>
            {fakeAlerts.map((alert) => (
              <div
                key={alert.id}
                className="px-3 py-2 rounded-lg border border-purple-500/20 bg-purple-500/5 backdrop-blur-sm text-[10px] font-mono text-purple-300/90 leading-tight"
                style={{ animation: 'hallucination-fade 4s forwards' }}
              >
                {alert.text}
              </div>
            ))}
          </AnimatePresence>
        </div>

        <div
          className="rounded-2xl border border-white/[0.08] p-5"
          style={{
            background: 'linear-gradient(165deg, rgba(18,18,28,0.92) 0%, rgba(8,8,14,0.96) 100%)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-emerald-400/90" />
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400/90">
              Behavioral Edge Score
            </span>
            <svg width="40" height="16" viewBox="0 0 40 16" className="ml-1" style={{ overflow: 'visible' }}>
              <polyline
                points="0,8 6,8 9,2 12,14 15,4 18,12 21,8 28,8 31,2 34,14 37,8 40,8"
                fill="none"
                stroke={heartRateColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="80"
                style={{ animation: `ecg-line ${heartRateAnimDur}s linear infinite` }}
              />
            </svg>
            <span className="text-[9px] font-mono tabular-nums ml-0.5" style={{ color: heartRateColor }}>
              {heartRate.toFixed(0)} bpm
            </span>
            <span className="ml-auto text-[10px] font-mono text-text-muted">{tiltZone}</span>
          </div>

          <div className="flex flex-col items-center justify-center">
            <svg width="200" height="120" viewBox="0 0 140 90" className="overflow-visible">
              <defs>
                <linearGradient id="besGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <circle
                cx="70"
                cy="70"
                r={gaugeR}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="10"
                strokeLinecap="round"
                transform="rotate(-90 70 70)"
              />
              <circle
                cx="70"
                cy="70"
                r={gaugeR}
                fill="none"
                stroke="url(#besGaugeGrad)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${besArc} ${gaugeC}`}
                transform="rotate(-90 70 70)"
                style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
              />
              <text
                x="70"
                y="68"
                textAnchor="middle"
                className="fill-text-primary font-mono text-[22px] font-bold"
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  fill: flickerValue !== null ? '#a855f7' : undefined,
                }}
              >
                {displayBes.toFixed(0)}
              </text>
              <text
                x="70"
                y="86"
                textAnchor="middle"
                className="fill-text-muted font-mono text-[9px] uppercase tracking-wider"
              >
                BES
              </text>
            </svg>
          </div>

          <div className="mt-4 space-y-2.5">
            {DIMENSION_LABELS.map(({ key, label }) => {
              const val = dimensions[key];
              const fill = gradientForValue(val);
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-[9px] font-mono text-text-muted w-24 shrink-0">{label}</span>
                  <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden border border-white/[0.05]">
                    <motion.div
                      className="h-full rounded-full"
                      initial={false}
                      animate={{ width: `${val}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      style={{
                        background: `linear-gradient(90deg, ${fill}99, ${fill})`,
                        boxShadow: `0 0 12px ${fill}33`,
                      }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-mono tabular-nums w-8 text-right"
                    style={{ color: fill }}
                  >
                    {val.toFixed(0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-black/20">
          <LiveChart height={180} compact />
        </div>

        {isLive && (
          <div
            className="rounded-2xl border border-white/[0.06] p-4"
            style={{ background: 'rgba(10, 10, 18, 0.95)' }}
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
                        <div className="text-[10px] text-text-muted font-mono">Entry</div>
                        <div className="text-sm font-bold text-text-primary tabular-nums font-mono">
                          {activePosition.entrySpot.toFixed(5)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-text-muted font-mono">Live P&amp;L</div>
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

                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent-primary"
                      animate={{ width: ['0%', '100%'] }}
                      transition={{ duration: Math.max(selectedDuration * 60, 1), ease: 'linear' }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => sellSimulatedTradeEarly()}
                    className="w-full h-10 rounded-xl border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/5 transition-all flex items-center justify-center gap-2 font-mono"
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
                      <Target className="w-3.5 h-3.5 text-accent-primary" />
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider font-mono">
                        Sprint ticket
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-accent-primary/10 text-accent-primary border border-accent-primary/20 font-mono">
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
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all border font-mono ${
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
                      className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold transition-all border font-mono ${
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
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n)) return;
                            setSelectedStake(clamp(Math.round(n), 1, 1000));
                          }}
                          min={1}
                          max={1000}
                          className="flex-1 h-9 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-accent-primary/30 focus:outline-none text-xs text-text-primary tabular-nums font-mono"
                        />
                        {[10, 25, 50].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setSelectedStake(preset)}
                            className={`px-2 h-9 rounded-lg text-[10px] font-bold transition-all border font-mono ${
                              selectedStake === preset
                                ? 'border-accent-primary/30 text-accent-primary bg-accent-primary/10'
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
                            className={`h-9 rounded-lg text-[10px] font-bold transition-all border font-mono ${
                              selectedDuration === preset.value
                                ? 'border-accent-primary/30 text-accent-primary bg-accent-primary/10'
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
                    <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-1.5 font-mono">
                      {tradeError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handlePlaceTrade}
                    disabled={isPlacingTrade || selectedStake <= 0}
                    className="w-full h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-white disabled:opacity-40 font-mono"
                    style={{
                      background:
                        selectedDirection === 'CALL'
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
                        Simulate Trade · {formatCurrency(selectedStake)}
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2 text-[9px] text-text-muted font-mono px-1">
                    <Activity className="w-3 h-3" />
                    Tilt {tiltScore}/100 — feeds emotional control
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {recentFlagBatches.length > 0 && (
          <div
            className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: 'rgba(12,12,20,0.85)' }}
          >
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
              Behavioral flags
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto scrollbar-custom">
              {recentFlagBatches.map((batch) => (
                <div key={batch.tradeId} className="space-y-1.5">
                  <div className="text-[9px] font-mono text-text-muted">Trade · {batch.tradeId.slice(0, 8)}…</div>
                  <div className="flex flex-wrap gap-1.5">
                    {batch.flags.map((f) => (
                      <span
                        key={`${batch.tradeId}-${f.id}`}
                        className={`text-[9px] px-2 py-0.5 rounded-md font-mono border ${
                          f.tone === 'positive'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : f.tone === 'warning'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                            : 'bg-red-500/10 text-red-400 border-red-500/25'
                        }`}
                      >
                        {f.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {taggedTrades.length > 0 && (
          <div
            className="rounded-xl border border-white/[0.06] p-4"
            style={{ background: 'rgba(12,12,20,0.85)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-3.5 h-3.5 text-text-muted" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
                Last trades
              </span>
            </div>
            <div className="space-y-2">
              {taggedTrades.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-xs font-mono font-bold shrink-0 ${
                          row.direction === 'CALL' ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {row.direction === 'CALL' ? '▲' : '▼'} {row.asset}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted truncate">
                        {formatCurrency(row.stake)}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono font-bold tabular-nums ${
                        row.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {row.pnl >= 0 ? '+' : ''}
                      {formatCurrency(row.pnl)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {row.tags.slice(0, 4).map((t) => (
                      <span
                        key={t.id}
                        className={`text-[8px] px-1.5 py-0.5 rounded font-mono border ${
                          t.tone === 'positive'
                            ? 'border-emerald-500/20 text-emerald-400/90'
                            : t.tone === 'warning'
                            ? 'border-amber-500/20 text-amber-400/90'
                            : 'border-red-500/20 text-red-400/90'
                        }`}
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            {
              label: 'BES',
              value: bes.toFixed(0),
              color: gradientForValue(bes),
            },
            {
              label: 'P&L',
              value: formatCurrency(sessionPnl),
              color: sessionPnl >= 0 ? '#34d399' : '#f87171',
            },
            {
              label: 'Trades',
              value: String(sessionTrades),
              color: 'var(--color-text-primary, #e2e8f0)',
            },
            {
              label: 'Best dim.',
              value: bestWorst.best,
              color: '#34d399',
            },
            {
              label: 'Worst dim.',
              value: bestWorst.worst,
              color: '#fb923c',
            },
            {
              label: 'H-Resist',
              value: String(hallucinationResistance),
              color: hallucinationResistance > 0 ? '#a855f7' : 'var(--color-text-primary, #e2e8f0)',
            },
            {
              label: 'Rank',
              value: '',
              node: <RankBadge size="sm" />,
            },
          ].map((cell) => (
            <div
              key={cell.label}
              className="rounded-xl border border-white/[0.06] p-3 text-center font-mono"
              style={{ background: 'rgba(8,8,14,0.9)' }}
            >
              <div className="text-[8px] text-text-muted uppercase tracking-wider mb-1">{cell.label}</div>
              {'node' in cell && cell.node ? (
                <div className="flex justify-center mt-1">{cell.node}</div>
              ) : (
                <div className="text-sm font-bold tabular-nums" style={{ color: cell.color }}>
                  {cell.value}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
