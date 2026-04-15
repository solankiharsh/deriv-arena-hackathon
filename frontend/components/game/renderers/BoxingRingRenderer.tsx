'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Loader2, XCircle,
  Zap, Shield, Swords, Clock, Activity, Trophy, Flame,
} from 'lucide-react';
import { BoxingRing } from '@/components/phantom-ledger/arena-ring/BoxingRing';
import { LiveChart } from '@/components/game/shared/LiveChart';
import { SymbolSelector } from '@/components/game/shared/SymbolSelector';
import { RankBadge } from '@/components/game/shared/RankBadge';
import { useArenaStore } from '@/lib/stores/arena-store';
import { useTradeStore } from '@/lib/stores/trade-store';
import { useTiltStore } from '@/lib/stores/tilt-store';
import { useHeroStore } from '@/lib/stores/hero-store';
import { useSessionStore } from '@/lib/stores/session-store';
import { formatCurrency } from '@/lib/utils/formatters';
import { TILT_ZONE_COLORS } from '@/lib/engines/tilt-detection';
import { fireArenaEvent } from '@/lib/engines/arena-events';
import {
  placeSimulatedTrade,
  sellSimulatedTradeEarly,
  hasActiveSimulation,
} from '@/lib/engines/trade-simulator';

interface BoxingRingRendererProps {
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

const STARTING_BALANCE = 10000;
const KO_TARGET_PCT = 0.2;

const CRACK_PATHS = [
  'M 50 0 L 48 15 L 55 28 L 45 42 L 52 55 L 40 70 L 50 85 L 42 100',
  'M 80 0 L 75 20 L 82 35 L 70 50 L 78 65 L 68 80 L 75 100',
  'M 20 0 L 25 18 L 18 32 L 28 48 L 15 62 L 22 78 L 18 100',
  'M 60 10 L 55 25 L 65 40 L 50 55 L 58 70 L 48 85',
  'M 35 5 L 40 22 L 32 38 L 42 52 L 30 68 L 38 82',
];

export default function BoxingRingRenderer({
  instanceId,
  userId,
  isLive,
  onScoreUpdate,
}: BoxingRingRendererProps) {
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
    setSelectedDirection,
    setSelectedStake,
    setSelectedDuration,
  } = useTradeStore();

  const {
    yourHealth,
    antiYouHealth,
    comboCount,
    round,
    sessionRecord,
    shakeIntensity,
    heatModeActive,
    setDamageLevel: storeSetDamageLevel,
    setHeatMode,
    setKnockoutProgress,
  } = useArenaStore();

  const { score: tiltScore, zone: tiltZone } = useTiltStore();
  const { fighterMode } = useHeroStore();
  const sessionId = useSessionStore((s) => s.currentSession?.id ?? instanceId);

  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [damageLevel, setDamageLevel] = useState(0);
  const [damageFlash, setDamageFlash] = useState(false);
  const [knockedOut, setKnockedOut] = useState(false);
  const [showKOCelebration, setShowKOCelebration] = useState(false);

  const prevTradesRef = useRef(sessionTrades);
  const prevLossStreakRef = useRef(lossStreak);
  const heatModeSecondsRef = useRef(0);
  const heatModeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tiltColor = TILT_ZONE_COLORS[tiltZone];
  const showTiltWarning = tiltScore > 40;
  const isOnTilt = tiltScore > 60;
  const isHeatMode = winStreak >= 3;

  const displayName = useTradeStore(
    (s) => s.availableSymbols.find((sym) => sym.symbol === s.selectedAsset)?.display_name
  ) ?? selectedAsset;

  const winRate = useMemo(() => {
    if (sessionTrades === 0) return 0;
    return Math.round((sessionWins / sessionTrades) * 100);
  }, [sessionTrades, sessionWins]);

  const knockoutProgress = useMemo(() => {
    return (sessionPnl / (STARTING_BALANCE * KO_TARGET_PCT)) * 100;
  }, [sessionPnl]);

  const displayStake = isHeatMode ? selectedStake * 1.5 : selectedStake;

  useEffect(() => {
    useArenaStore.getState().resetArena();
  }, []);

  useEffect(() => {
    if (lossStreak > prevLossStreakRef.current) {
      const newLevel = damageLevel + 1;
      setDamageLevel(newLevel);
      storeSetDamageLevel(newLevel);
      setDamageFlash(true);
      const timer = setTimeout(() => setDamageFlash(false), 500);
      return () => clearTimeout(timer);
    }
    if (lossStreak === 0 && prevLossStreakRef.current > 0) {
      setDamageLevel(0);
      storeSetDamageLevel(0);
    }
    prevLossStreakRef.current = lossStreak;
  }, [lossStreak]);

  useEffect(() => {
    if (isHeatMode && !heatModeActive) {
      setHeatMode(true);
      fireArenaEvent('HEAT_MODE_ACTIVATED', sessionId);
      heatModeSecondsRef.current = 0;
      heatModeIntervalRef.current = setInterval(() => {
        heatModeSecondsRef.current += 1;
      }, 1000);
    } else if (!isHeatMode && heatModeActive) {
      setHeatMode(false);
      if (heatModeIntervalRef.current) {
        clearInterval(heatModeIntervalRef.current);
        heatModeIntervalRef.current = null;
      }
    }
  }, [isHeatMode, heatModeActive, setHeatMode, sessionId]);

  useEffect(() => {
    return () => {
      if (heatModeIntervalRef.current) {
        clearInterval(heatModeIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const progress = Math.max(0, Math.min(100, knockoutProgress));
    setKnockoutProgress(progress);

    if (progress >= 100 && !knockedOut) {
      setKnockedOut(true);
      setShowKOCelebration(true);
      fireArenaEvent('KNOCKOUT_FINISHER', sessionId);
    }
  }, [knockoutProgress, knockedOut, setKnockoutProgress, sessionId]);

  useEffect(() => {
    if (sessionTrades > prevTradesRef.current && isLive) {
      prevTradesRef.current = sessionTrades;

      const healthDiff = yourHealth - antiYouHealth;
      const comboBonus = comboCount * 5;
      const knockoutBonus = knockedOut ? 500 : 0;
      const score =
        sessionPnl * 0.3 +
        healthDiff * 0.2 +
        comboBonus * 0.15 +
        heatModeSecondsRef.current * 0.1 +
        knockoutBonus * 0.25;

      onScoreUpdate({
        score: Math.max(0, score),
        pnl: sessionPnl,
        trades_count: sessionTrades,
        behavioral_score: Math.max(0, 100 - tiltScore),
      });
    }
  }, [sessionTrades, sessionPnl, sessionWins, yourHealth, antiYouHealth, tiltScore, comboCount, isLive, onScoreUpdate, knockedOut]);

  const handlePlaceTrade = async () => {
    if (!isLive || isPlacingTrade || hasActiveSimulation() || knockedOut) return;
    setIsPlacingTrade(true);
    setTradeError(null);

    const result = await placeSimulatedTrade({
      asset: selectedAsset,
      assetDisplayName: displayName,
      direction: selectedDirection,
      stake: isHeatMode ? selectedStake * 1.5 : selectedStake,
      duration: selectedDuration,
      durationUnit: selectedDurationUnit,
    });

    if (!result.success) {
      setTradeError(result.error ?? 'Trade failed');
    }
    setIsPlacingTrade(false);
  };

  const pnlIsPositive = sessionPnl >= 0;
  const crackOpacity = Math.min(0.8, damageLevel * 0.15);

  return (
    <div
      className="space-y-0 relative"
      style={{
        '--shake-intensity': `${shakeIntensity}`,
      } as React.CSSProperties}
    >
      <AnimatePresence>
        {damageFlash && (
          <motion.div
            key="damage-flash"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(239, 68, 68, 0.6) 100%)',
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showKOCelebration && (
          <motion.div
            key="ko-celebration"
            initial={{ opacity: 0, scale: 1.2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="ko-slowmo fixed inset-0 z-[200] flex flex-col items-center justify-center pointer-events-auto"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.15) 0%, rgba(0, 0, 0, 0.92) 70%)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setShowKOCelebration(false)}
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
              className="text-center"
            >
              <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500 mb-4 drop-shadow-[0_0_40px_rgba(255,215,0,0.5)]">
                KNOCKOUT!
              </div>
              <div className="text-xl text-amber-200/80 font-bold mb-2">
                20% Profit Target Reached
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono mb-6">
                {formatCurrency(sessionPnl)}
              </div>
              <div className="text-sm text-white/40">Tap to dismiss</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`relative rounded-t-2xl overflow-hidden border border-white/[0.06] ${isHeatMode ? 'heat-mode-border' : ''}`}
        style={isHeatMode ? {
          boxShadow: '0 0 30px rgba(255, 165, 0, 0.15), inset 0 0 30px rgba(255, 165, 0, 0.05)',
          borderColor: 'rgba(255, 165, 0, 0.4)',
          animation: 'heat-pulse 2s ease-in-out infinite',
        } : undefined}
      >
        {damageLevel > 0 && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-30"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ opacity: crackOpacity }}
          >
            {CRACK_PATHS.slice(0, Math.min(damageLevel, CRACK_PATHS.length)).map((d, i) => (
              <path
                key={i}
                d={d}
                fill="none"
                stroke="rgba(255, 255, 255, 0.7)"
                strokeWidth="0.4"
                strokeLinecap="round"
                style={{
                  filter: 'drop-shadow(0 0 2px rgba(255, 255, 255, 0.5))',
                }}
              />
            ))}
          </svg>
        )}

        <div
          className="absolute inset-0 pointer-events-none z-20 transition-all duration-700"
          style={{
            background: pnlIsPositive && sessionTrades > 0
              ? 'linear-gradient(90deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.06) 12%, transparent 30%, transparent 70%, transparent 100%)'
              : !pnlIsPositive && sessionTrades > 0
              ? 'linear-gradient(90deg, transparent 0%, transparent 30%, transparent 70%, rgba(239,68,68,0.06) 88%, rgba(239,68,68,0.18) 100%)'
              : 'none',
          }}
        />
        {activePosition && (
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              boxShadow: activePosition.currentPnl >= 0
                ? 'inset 6px 0 40px -10px rgba(16,185,129,0.25), inset -2px 0 20px -10px transparent'
                : 'inset -6px 0 40px -10px rgba(239,68,68,0.25), inset 2px 0 20px -10px transparent',
              transition: 'box-shadow 0.3s ease',
            }}
          />
        )}

        <AnimatePresence>
          {isHeatMode && (
            <motion.div
              key="heat-banner"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-1.5 rounded-full"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 140, 0, 0.9), rgba(255, 69, 0, 0.9))',
                boxShadow: '0 0 20px rgba(255, 140, 0, 0.4), 0 0 60px rgba(255, 69, 0, 0.2)',
                animation: 'heat-banner-pulse 1.5s ease-in-out infinite',
              }}
            >
              <Flame className="w-4 h-4 text-yellow-200 animate-pulse" />
              <span className="text-xs font-black text-white uppercase tracking-widest">Heat Mode</span>
              <span className="text-[10px] font-bold text-yellow-200/90">1.5x</span>
            </motion.div>
          )}
        </AnimatePresence>

        <BoxingRing />
      </div>

      {sessionPnl > 0 && (
        <div className="h-1 w-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full"
            style={{
              background: knockoutProgress >= 100
                ? 'linear-gradient(90deg, #fbbf24, #f59e0b, #d97706)'
                : 'linear-gradient(90deg, #10b981, #059669)',
              width: `${Math.min(100, Math.max(0, knockoutProgress))}%`,
            }}
            animate={knockoutProgress >= 100 ? {
              boxShadow: ['0 0 8px rgba(251, 191, 36, 0.6)', '0 0 16px rgba(251, 191, 36, 0.8)', '0 0 8px rgba(251, 191, 36, 0.6)'],
            } : undefined}
            transition={knockoutProgress >= 100 ? { duration: 1, repeat: Infinity } : undefined}
          />
        </div>
      )}

      <div className="border-x border-white/[0.06]">
        <LiveChart height={160} compact />
      </div>

      {isLive && (
        <div
          className="rounded-b-2xl border border-t-0 border-white/[0.06] p-3"
          style={{
            background: 'rgba(10, 10, 18, 0.95)',
            borderColor: showTiltWarning ? `${tiltColor}30` : undefined,
            boxShadow: showTiltWarning ? `inset 0 0 30px ${tiltColor}08` : undefined,
            transition: 'border-color 2s ease, box-shadow 2s ease',
          }}
        >
          <AnimatePresence mode="wait">
            {knockedOut && !showKOCelebration ? (
              <motion.div
                key="knocked-out"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-8 text-center space-y-3"
              >
                <Trophy className="w-10 h-10 text-amber-400 mx-auto" />
                <div className="text-lg font-black text-amber-400">KNOCKOUT ACHIEVED</div>
                <div className="text-sm text-text-muted">
                  Final P&L: <span className="text-emerald-400 font-bold font-mono">{formatCurrency(sessionPnl)}</span>
                </div>
                <div className="text-xs text-text-muted/60">Trading disabled — session complete</div>
              </motion.div>
            ) : activePosition ? (
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
                    borderColor: activePosition.currentPnl >= 0 ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
                    background: activePosition.currentPnl >= 0 ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-text-primary">{activePosition.asset}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activePosition.direction === 'CALL'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
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
                      <div className={`text-2xl font-black tabular-nums font-mono ${
                        activePosition.currentPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {formatCurrency(activePosition.currentPnl)}
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[9px] text-text-muted mb-1">
                    <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Time remaining</span>
                    <span className="font-mono">Running...</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-accent-primary"
                      animate={{ width: ['0%', '100%'] }}
                      transition={{ duration: selectedDuration * 60, ease: 'linear' }}
                    />
                  </div>
                </div>

                <button
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
                    <Swords className="w-3.5 h-3.5 text-accent-primary" />
                    <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">Trade Ticket</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                      SIM
                    </span>
                  </div>
                  <RankBadge size="sm" />
                </div>

                <SymbolSelector compact />

                <div className="grid grid-cols-2 gap-2">
                  <button
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
                      Stake (USD){isHeatMode && <span className="text-orange-400 ml-1">× 1.5</span>}
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        value={selectedStake}
                        onChange={(e) => setSelectedStake(Number(e.target.value))}
                        min={1}
                        max={1000}
                        className="flex-1 h-9 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] focus:border-accent-primary/30 focus:outline-none text-xs text-text-primary tabular-nums font-mono"
                      />
                      {[10, 25, 50].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setSelectedStake(preset)}
                          className={`px-2 h-9 rounded-lg text-[10px] font-bold transition-all border ${
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
                          onClick={() => setSelectedDuration(preset.value)}
                          className={`h-9 rounded-lg text-[10px] font-bold transition-all border ${
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
                  <div className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-1.5">
                    {tradeError}
                  </div>
                )}

                <button
                  onClick={handlePlaceTrade}
                  disabled={isPlacingTrade || selectedStake <= 0 || knockedOut}
                  className="w-full h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-white disabled:opacity-40"
                  style={{
                    background: isOnTilt
                      ? `linear-gradient(135deg, ${tiltColor}80, ${tiltColor})`
                      : isHeatMode
                      ? 'linear-gradient(135deg, #d97706, #f59e0b)'
                      : selectedDirection === 'CALL'
                      ? 'linear-gradient(135deg, #059669, #10b981)'
                      : 'linear-gradient(135deg, #dc2626, #ef4444)',
                  }}
                >
                  {isPlacingTrade ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {isHeatMode && <Flame className="w-4 h-4" />}
                      {selectedDirection === 'CALL' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      Simulate Trade · {formatCurrency(displayStake)}
                    </>
                  )}
                </button>

                {showTiltWarning && (
                  <div className="flex items-center gap-2 text-[10px] rounded-lg px-3 py-2 border" style={{ color: tiltColor, borderColor: `${tiltColor}25`, background: `${tiltColor}08` }}>
                    <Zap className="w-3.5 h-3.5 animate-pulse flex-shrink-0" />
                    <span className="font-mono">
                      Tilt {tiltScore}/100 — win rate drops {tiltScore > 60 ? '40%' : '20%'} at this level
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 flex-wrap px-1">
        {[
          { icon: Swords, label: 'Trades', value: `${sessionWins}/${sessionTrades}`, color: undefined },
          { icon: Activity, label: 'P&L', value: formatCurrency(sessionPnl), color: sessionPnl >= 0 ? '#10b981' : '#ef4444' },
          { icon: Trophy, label: 'WR', value: `${winRate}%`, color: winRate >= 50 ? '#10b981' : '#ef4444' },
          { icon: Shield, label: 'HP', value: `${yourHealth}`, color: yourHealth > 50 ? '#10b981' : '#ef4444' },
          { icon: Zap, label: 'Tilt', value: `${tiltScore}`, color: tiltColor },
          { icon: Swords, label: 'Rnd', value: `R${round}`, color: '#E8B45E' },
          ...(isHeatMode ? [{ icon: Flame, label: 'Heat', value: `${winStreak}W`, color: '#f59e0b' }] : []),
          ...(knockoutProgress > 0 ? [{ icon: Trophy, label: 'KO', value: `${Math.round(Math.min(100, knockoutProgress))}%`, color: '#fbbf24' }] : []),
        ].map((stat, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 glass rounded-lg px-2.5 py-1.5"
          >
            <stat.icon className="w-3 h-3 text-text-muted flex-shrink-0" />
            <span className="text-[9px] text-text-muted uppercase">{stat.label}</span>
            <span
              className="text-xs font-mono font-bold tabular-nums"
              style={{ color: stat.color ?? 'var(--color-text-primary, #e2e8f0)' }}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes heat-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 165, 0, 0.1), inset 0 0 20px rgba(255, 165, 0, 0.03); }
          50% { box-shadow: 0 0 40px rgba(255, 165, 0, 0.25), inset 0 0 40px rgba(255, 165, 0, 0.08); }
        }
        @keyframes heat-banner-pulse {
          0%, 100% { transform: translateX(-50%) scale(1); filter: brightness(1); }
          50% { transform: translateX(-50%) scale(1.03); filter: brightness(1.15); }
        }
        .ko-slowmo {
          animation: ko-entrance 0.8s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes ko-entrance {
          0% { opacity: 0; transform: scale(1.3); filter: blur(10px); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
      `}</style>
    </div>
  );
}
