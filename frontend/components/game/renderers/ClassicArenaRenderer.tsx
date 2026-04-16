"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sfx } from "@/lib/sounds";
import {
  BarChart3,
  Clock,
  Loader2,
  TrendingDown,
  TrendingUp,
  Timer,
  XCircle,
  Zap,
} from "lucide-react";
import { LiveChart } from "@/components/game/shared/LiveChart";
import { RankBadge } from "@/components/game/shared/RankBadge";
import { SymbolSelector } from "@/components/game/shared/SymbolSelector";
import {
  hasActiveSimulation,
  placeSimulatedTrade,
  sellSimulatedTradeEarly,
} from "@/lib/engines/trade-simulator";
import {
  TILT_ZONE_COLORS,
  TILT_ZONE_LABELS,
} from "@/lib/engines/tilt-detection";
import {
  getRandomHeadline,
  getNextChaosInterval,
  CHAOS_DISPLAY_DURATION_MS,
  CHAOS_EFFECT_DURATION_MS,
  CHAOS_SCORE_MULTIPLIER,
  resetChaosEngine,
  type ChaosHeadline,
} from "@/lib/engines/chaos-engine";
import {
  usePowerUpStore,
  POWER_UP_DEFS,
  type PowerUpType,
} from "@/lib/stores/powerup-store";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { formatCurrency } from "@/lib/utils/formatters";

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

const STAKE_PRESETS = [5, 10, 25, 50] as const;

const DURATION_PRESETS: ReadonlyArray<{
  label: string;
  duration: number;
  unit: string;
}> = [
  { label: "1m", duration: 1, unit: "m" },
  { label: "5m", duration: 5, unit: "m" },
  { label: "15m", duration: 15, unit: "m" },
  { label: "1h", duration: 1, unit: "h" },
];

const POWER_UP_ICONS: Record<PowerUpType, typeof Zap> = {
  lag_spike: Zap,
  flash_crash: BarChart3,
  time_warp: Clock,
};

const POWER_UP_ORDER: PowerUpType[] = ["lag_spike", "flash_crash", "time_warp"];

function CooldownRing({
  type,
  size = 44,
}: {
  type: PowerUpType;
  size?: number;
}) {
  const cooldownEnd = usePowerUpStore((s) => s.cooldowns[type]);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (cooldownEnd <= Date.now()) {
      setProgress(0);
      return;
    }
    const def = POWER_UP_DEFS[type];
    const update = () => {
      const remaining = cooldownEnd - Date.now();
      if (remaining <= 0) {
        setProgress(0);
        return;
      }
      setProgress(remaining / def.cooldownMs);
    };
    update();
    const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [cooldownEnd, type]);

  if (progress <= 0) return null;

  const r = (size - 4) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progress);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)" }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(232, 180, 94, 0.35)"
        strokeWidth={2.5}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ClassicArenaRenderer(props: Props) {
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
    winStreak,
    lossStreak,
    availableSymbols,
    setSelectedDirection,
    setSelectedStake,
    setSelectedDuration,
    setSelectedDurationUnit,
  } = useTradeStore();

  const tiltScore = useTiltStore((s) => s.score);
  const tiltZone = useTiltStore((s) => s.zone);

  const credits = usePowerUpStore((s) => s.credits);
  const addCredits = usePowerUpStore((s) => s.addCredits);
  const activatePowerUp = usePowerUpStore((s) => s.activate);
  const canAfford = usePowerUpStore((s) => s.canAfford);
  const isOnCooldown = usePowerUpStore((s) => s.isOnCooldown);
  const tickPowerUps = usePowerUpStore((s) => s.tick);
  const resetPowerUps = usePowerUpStore((s) => s.reset);

  const [isPlacing, setIsPlacing] = useState(false);
  const [isSelling, setIsSelling] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const prevSessionTradesRef = useRef(sessionTrades);

  const [activatedButton, setActivatedButton] = useState<PowerUpType | null>(
    null
  );
  const [powerUpsUsed, setPowerUpsUsed] = useState(0);

  const [chaosHeadline, setChaosHeadline] = useState<ChaosHeadline | null>(
    null
  );
  const [chaosActive, setChaosActive] = useState(false);
  const [chaosTradesCount, setChaosTradesCount] = useState(0);
  const chaosActiveRef = useRef(false);
  const chaosTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const assetDisplayName = useMemo(
    () =>
      availableSymbols.find((s) => s.symbol === selectedAsset)?.display_name ??
      selectedAsset,
    [availableSymbols, selectedAsset]
  );

  const winRate =
    sessionTrades > 0 ? (sessionWins / sessionTrades) * 100 : 0;

  const streakLabel = useMemo(() => {
    if (winStreak > 0) return `W${winStreak}`;
    if (lossStreak > 0) return `L${lossStreak}`;
    return "—";
  }, [winStreak, lossStreak]);

  const hasOpenPosition =
    activePosition !== null && activePosition.status === "open";

  useEffect(() => {
    if (!hasOpenPosition) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [hasOpenPosition]);

  useEffect(() => {
    const id = window.setInterval(tickPowerUps, 250);
    return () => window.clearInterval(id);
  }, [tickPowerUps]);

  useEffect(() => {
    if (sessionTrades > prevSessionTradesRef.current) {
      sfx.play(winStreak > 0 ? 'trade_win' : 'trade_loss');
      addCredits(1);

      if (chaosActiveRef.current) {
        setChaosTradesCount((c) => c + 1);
      }

      const ts = useTiltStore.getState().score;
      const powerUpEfficiency =
        (powerUpsUsed / Math.max(sessionTrades, 1)) * 100;
      const currentChaosBonus =
        (chaosActiveRef.current ? chaosTradesCount + 1 : chaosTradesCount) *
        CHAOS_SCORE_MULTIPLIER *
        10;

      const score =
        sessionPnl * 0.4 +
        winRate * 25 +
        powerUpEfficiency * 0.15 +
        currentChaosBonus * 0.2;

      onScoreUpdate({
        score,
        pnl: sessionPnl,
        trades_count: sessionTrades,
        behavioral_score: Math.max(0, 100 - ts),
      });
    }
    prevSessionTradesRef.current = sessionTrades;
  }, [
    sessionTrades,
    sessionPnl,
    onScoreUpdate,
    winRate,
    addCredits,
    powerUpsUsed,
    chaosTradesCount,
  ]);

  const fireChaosEvent = useCallback(() => {
    const headline = getRandomHeadline();
    setChaosHeadline(headline);
    setChaosActive(true);
    chaosActiveRef.current = true;
    sfx.play('chaos_alert');

    setTimeout(() => {
      setChaosHeadline(null);
    }, CHAOS_DISPLAY_DURATION_MS);

    setTimeout(() => {
      setChaosActive(false);
      chaosActiveRef.current = false;
    }, CHAOS_EFFECT_DURATION_MS);
  }, []);

  const scheduleChaos = useCallback(() => {
    chaosTimerRef.current = setTimeout(() => {
      fireChaosEvent();
      scheduleChaos();
    }, getNextChaosInterval());
  }, [fireChaosEvent]);

  useEffect(() => {
    if (!isLive) return;
    resetChaosEngine();
    resetPowerUps();
    setChaosTradesCount(0);
    setPowerUpsUsed(0);
    scheduleChaos();
    return () => {
      if (chaosTimerRef.current) clearTimeout(chaosTimerRef.current);
    };
  }, [isLive, scheduleChaos, resetPowerUps]);

  const handlePowerUp = useCallback(
    (type: PowerUpType) => {
      const ok = activatePowerUp(type);
      if (!ok) return;
      sfx.play('powerup');
      setPowerUpsUsed((c) => c + 1);
      setActivatedButton(type);
      setTimeout(() => setActivatedButton(null), 500);
    },
    [activatePowerUp]
  );

  const handleBuy = useCallback(async () => {
    if (!isLive || isPlacing || hasActiveSimulation()) return;
    sfx.play('trade_place');
    setIsPlacing(true);
    try {
      await placeSimulatedTrade({
        asset: selectedAsset,
        assetDisplayName,
        direction: selectedDirection,
        stake: selectedStake,
        duration: selectedDuration,
        durationUnit: selectedDurationUnit,
      });
    } finally {
      setIsPlacing(false);
    }
  }, [
    isLive,
    isPlacing,
    selectedAsset,
    assetDisplayName,
    selectedDirection,
    selectedStake,
    selectedDuration,
    selectedDurationUnit,
  ]);

  const handleSellEarly = useCallback(async () => {
    if (!hasActiveSimulation() || isSelling) return;
    setIsSelling(true);
    try {
      await sellSimulatedTradeEarly();
    } finally {
      setIsSelling(false);
    }
  }, [isSelling]);

  const timeRemainingMs =
    activePosition && activePosition.expiryTime > 0
      ? Math.max(0, activePosition.expiryTime - nowTick)
      : 0;

  const formatRemaining = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const buyBlocked = !isLive || isPlacing || hasActiveSimulation();

  const pnlClass = (v: number) =>
    v >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <div
      className="flex flex-col gap-4"
      data-instance-id={instanceId}
      data-user-id={userId}
    >
      <style>{`
        @keyframes powerup-burst {
          0% { transform: scale(1); filter: brightness(1); }
          30% { transform: scale(1.15); filter: brightness(1.6); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes news-slide-in {
          0% { transform: translateX(100%); opacity: 0; }
          8% { transform: translateX(0); opacity: 1; }
          85% { transform: translateX(0); opacity: 1; }
          100% { transform: translateX(-100%); opacity: 0; }
        }
        @keyframes chart-noise {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-1px, 1px); }
          20% { transform: translate(1px, -1px); }
          30% { transform: translate(-1px, 0); }
          40% { transform: translate(1px, 1px); }
          50% { transform: translate(0, -1px); }
          60% { transform: translate(-1px, 1px); }
          70% { transform: translate(1px, 0); }
          80% { transform: translate(0, 1px); }
          90% { transform: translate(1px, -1px); }
        }
      `}</style>

      <AnimatePresence>
        {chaosHeadline && (
          <motion.div
            key={chaosHeadline.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-50 overflow-hidden rounded-2xl border border-red-500/40 bg-red-600 px-4 py-3"
            style={{ animation: "news-slide-in 5s ease-in-out forwards" }}
          >
            <div className="flex items-center gap-3">
              <span className="shrink-0 rounded bg-white/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-white">
                Breaking News
              </span>
              <span className="truncate text-sm font-bold text-white">
                {chaosHeadline.text}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-white/60">
              {chaosHeadline.source}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "#E8B45E" }}
          >
            Power-ups
          </span>
          <span className="flex items-center gap-1 font-mono text-xs tabular-nums text-[#E8B45E]">
            <Zap className="h-3 w-3" />
            {credits}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {POWER_UP_ORDER.map((type) => {
            const def = POWER_UP_DEFS[type];
            const Icon = POWER_UP_ICONS[type];
            const disabled = !isLive || !canAfford(type) || isOnCooldown(type);
            const justActivated = activatedButton === type;

            return (
              <button
                key={type}
                type="button"
                disabled={disabled}
                onClick={() => handlePowerUp(type)}
                className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-all ${
                  disabled
                    ? "cursor-not-allowed border-white/[0.04] bg-white/[0.01] text-text-muted opacity-50"
                    : "border-[#E8B45E]/20 bg-[#E8B45E]/5 text-[#E8B45E] hover:border-[#E8B45E]/40 hover:bg-[#E8B45E]/10"
                }`}
                style={
                  justActivated
                    ? { animation: "powerup-burst 0.5s ease-out" }
                    : undefined
                }
              >
                <CooldownRing type={type} />
                <Icon className="h-4 w-4 shrink-0" />
                <span className="text-[10px] font-semibold leading-none">
                  {def.label}
                </span>
                <span className="font-mono text-[9px] tabular-nums opacity-70">
                  {def.cost} cr
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={chaosActive ? "relative" : ""}>
        {chaosActive && (
          <div
            className="pointer-events-none absolute inset-0 z-10 rounded-2xl"
            style={{ animation: "chart-noise 0.3s infinite" }}
          />
        )}
        <LiveChart height={260} />
      </div>

      <div className="glass rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
        <SymbolSelector />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.button
          type="button"
          whileTap={{ scale: 0.99 }}
          onClick={() => setSelectedDirection("CALL")}
          className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold tracking-wide transition-colors ${
            selectedDirection === "CALL"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-[0_0_24px_-8px_rgba(16,185,129,0.45)]"
              : "border-white/[0.06] bg-white/[0.03] text-text-muted hover:border-white/[0.1] hover:text-text-secondary"
          }`}
        >
          <TrendingUp className="h-5 w-5 shrink-0" strokeWidth={2.25} />
          <span className="text-sm uppercase">Rise</span>
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.99 }}
          onClick={() => setSelectedDirection("PUT")}
          className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold tracking-wide transition-colors ${
            selectedDirection === "PUT"
              ? "border-red-500/50 bg-red-500/10 text-red-400 shadow-[0_0_24px_-8px_rgba(239,68,68,0.45)]"
              : "border-white/[0.06] bg-white/[0.03] text-text-muted hover:border-white/[0.1] hover:text-text-secondary"
          }`}
        >
          <TrendingDown className="h-5 w-5 shrink-0" strokeWidth={2.25} />
          <span className="text-sm uppercase">Fall</span>
        </motion.button>
      </div>

      <div className="glass rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div
          className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "#E8B45E" }}
        >
          Stake
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STAKE_PRESETS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => setSelectedStake(amt)}
              className={`rounded-lg border py-2.5 font-mono text-xs tabular-nums transition-all ${
                selectedStake === amt
                  ? "border-[#E8B45E]/40 bg-[#E8B45E]/10 text-[#E8B45E]"
                  : "border-white/[0.06] bg-white/[0.02] text-text-secondary hover:border-white/[0.12]"
              }`}
            >
              {`$${amt}`}
            </button>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div
          className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: "#E8B45E" }}
        >
          Duration
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {DURATION_PRESETS.map((p) => {
            const active =
              selectedDuration === p.duration &&
              selectedDurationUnit === p.unit;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setSelectedDuration(p.duration);
                  setSelectedDurationUnit(p.unit);
                }}
                className={`rounded-lg border py-2.5 font-mono text-xs tabular-nums transition-all ${
                  active
                    ? "border-[#E8B45E]/40 bg-[#E8B45E]/10 text-[#E8B45E]"
                    : "border-white/[0.06] bg-white/[0.02] text-text-secondary hover:border-white/[0.12]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="popLayout">
        {hasOpenPosition && activePosition && (
          <motion.div
            key="active-position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="glass overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]"
          >
            <div
              className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5"
              style={{ background: "rgba(232, 180, 94, 0.06)" }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: "#E8B45E" }}
              >
                Open position
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-text-muted">
                <Timer className="h-3 w-3" />
                {formatRemaining(timeRemainingMs)}
              </span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-text-muted">
                  Side
                </div>
                <div
                  className={`mt-1 flex items-center gap-2 font-mono text-sm font-semibold tabular-nums ${
                    activePosition.direction === "CALL"
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {activePosition.direction === "CALL" ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  {activePosition.direction === "CALL" ? "RISE" : "FALL"}
                </div>
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-wider text-text-muted">
                  Entry
                </div>
                <div className="mt-1 font-mono text-sm tabular-nums text-text-primary">
                  {activePosition.entrySpot > 0
                    ? activePosition.entrySpot.toFixed(4)
                    : "—"}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-[9px] uppercase tracking-wider text-text-muted">
                  Mark P&amp;L
                </div>
                <div
                  className={`mt-1 font-mono text-lg font-semibold tabular-nums ${pnlClass(
                    activePosition.currentPnl
                  )}`}
                >
                  {activePosition.entrySpot > 0
                    ? `${activePosition.currentPnl >= 0 ? "+" : ""}${formatCurrency(
                        activePosition.currentPnl,
                        "USD",
                        true
                      )}`
                    : "—"}
                </div>
              </div>
            </div>
            <div className="border-t border-white/[0.06] p-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.99 }}
                disabled={isSelling}
                onClick={handleSellEarly}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.05] py-2.5 text-xs font-semibold text-text-secondary transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
              >
                {isSelling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Sell early
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileTap={{ scale: buyBlocked ? 1 : 0.995 }}
        disabled={buyBlocked}
        onClick={handleBuy}
        className={`relative overflow-hidden rounded-2xl border px-4 py-4 text-sm font-bold uppercase tracking-[0.12em] transition-all ${
          selectedDirection === "CALL"
            ? "border-emerald-500/40 bg-emerald-600/90 text-black hover:bg-emerald-500"
            : "border-red-500/40 bg-red-600/90 text-white hover:bg-red-500"
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isPlacing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              {selectedDirection === "CALL" ? (
                <TrendingUp className="h-5 w-5" />
              ) : (
                <TrendingDown className="h-5 w-5" />
              )}
              Buy {selectedDirection === "CALL" ? "Rise" : "Fall"} ·{" "}
              {formatCurrency(selectedStake)}
            </>
          )}
        </span>
      </motion.button>

      <div className="glass rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
        <div className="mb-3">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "#E8B45E" }}
          >
            Session
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            {
              label: "Trades",
              value: String(sessionTrades),
              valueClass: "text-text-primary",
            },
            {
              label: "P&L",
              value: formatCurrency(sessionPnl, "USD", true),
              valueClass: pnlClass(sessionPnl),
            },
            {
              label: "Win rate",
              value: `${winRate.toFixed(1)}%`,
              valueClass: "text-text-primary",
            },
            {
              label: "Streak",
              value: streakLabel,
              valueClass: "text-text-primary",
            },
            {
              label: "Tilt",
              value: `${tiltScore.toFixed(0)}`,
              valueClass: "text-text-primary",
              accent: TILT_ZONE_COLORS[tiltZone],
            },
            {
              label: "Rank",
              value: "",
              rank: true,
            },
          ].map((cell) => (
            <div
              key={cell.label}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"
            >
              <div className="text-[9px] font-medium uppercase tracking-wider text-text-muted">
                {cell.label}
              </div>
              {"rank" in cell && cell.rank ? (
                <div className="mt-2 flex justify-start">
                  <RankBadge size="md" showXp />
                </div>
              ) : (
                <div
                  className={`mt-1 font-mono text-base font-semibold tabular-nums ${cell.valueClass}`}
                  style={
                    "accent" in cell && cell.accent
                      ? { color: cell.accent as string }
                      : undefined
                  }
                >
                  {cell.value}
                </div>
              )}
              {cell.label === "Tilt" && (
                <div
                  className="mt-1 text-[9px] font-mono uppercase tracking-wide text-text-muted"
                  style={{ color: TILT_ZONE_COLORS[tiltZone] }}
                >
                  {TILT_ZONE_LABELS[tiltZone]}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-5"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Progression
        </span>
        <RankBadge size="lg" showXp />
      </motion.div>
    </div>
  );
}
