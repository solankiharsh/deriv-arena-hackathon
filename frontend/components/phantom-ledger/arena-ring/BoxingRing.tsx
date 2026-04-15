"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useArenaStore, type FighterAction } from "@/lib/stores/arena-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useAntiYouStore } from "@/lib/stores/anti-you-store";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useHeroStore } from "@/lib/stores/hero-store";
import { TILT_ZONE_COLORS } from "@/lib/engines/tilt-detection";
import { getEventLabel, EVENT_COLORS } from "@/lib/engines/arena-events";
import { formatCurrency } from "@/lib/utils/formatters";
import { xpToRank, formatRank } from "@/lib/engines/achievement";
import { calculateEstimatedXp } from "@/lib/utils/progression";
import { HEROES, RING_THEMES } from "@/lib/arena/hero-data";
import { SPRITE_CHARACTERS } from "@/lib/arena/sprite-data";
import { cn } from "@/lib/utils/cn";
import { AnimeHeroFighter } from "./AnimeHeroFighter";
import { SpriteAnimator } from "./SpriteAnimator";
import { HeroCustomizePopup } from "./HeroCustomizePopup";

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs leading-tight">
      <span className="text-[var(--color-text-muted)] uppercase tracking-wider whitespace-nowrap truncate">{label}</span>
      <span className="font-bold tabular-nums text-right shrink-0" style={{ color: color ?? "var(--color-text)" }}>{value}</span>
    </div>
  );
}

function HealthBar({ health, side, color }: { health: number; side: "left" | "right"; color: string }) {
  const dangerColor = "var(--color-danger)";
  const isLow = health < 25;
  return (
    <div className="relative w-full h-2.5 rounded-sm overflow-hidden bg-white/8">
      <motion.div
        className="absolute top-0 h-full rounded-sm"
        style={{
          [side === "left" ? "left" : "right"]: 0,
          background: isLow ? `linear-gradient(${side === "left" ? "90deg" : "270deg"}, ${dangerColor}, ${color})` : color,
          boxShadow: `0 0 8px ${color}60`,
        }}
        animate={{ width: `${health}%` }}
        transition={{ type: "spring", damping: 20, stiffness: 150 }}
      />
    </div>
  );
}

const EVO_THRESHOLDS = [
  { stage: "SIMPLE_MIRROR", label: "MIRROR", min: 0, max: 5 },
  { stage: "PATTERN_MIRROR", label: "PATTERN", min: 5, max: 15 },
  { stage: "BEHAVIORAL_MIRROR", label: "BEHAVIOR", min: 15, max: 30 },
  { stage: "FULL_INVERSE", label: "INVERSE", min: 30, max: 999 },
] as const;

function EvolutionProgress({ evolution, totalTrades }: { evolution: string; totalTrades: number }) {
  const current = EVO_THRESHOLDS.find((e) => e.stage === evolution) ?? EVO_THRESHOLDS[0];
  const pct = current.max < 999
    ? Math.min(100, Math.round(((totalTrades - current.min) / (current.max - current.min)) * 100))
    : 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[9px] mb-0.5">
        <span className="text-[var(--color-anti-you)] font-bold">{current.label}</span>
        <span className="text-[var(--color-text-muted)] tabular-nums">{totalTrades} trades</span>
      </div>
      <div className="relative w-full h-1 rounded-full overflow-hidden bg-white/8">
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: "var(--color-anti-you)",
            transition: "width 0.5s ease",
          }}
        />
      </div>
    </div>
  );
}

export function BoxingRing() {
  const {
    yourHealth, antiYouHealth, round, activeEvent,
    isShaking, comboCount, sessionResult,
    yourAction, antiYouAction, sessionRecord,
  } = useArenaStore();
  const { sessionPnl, winStreak, lossStreak, sessionTrades, sessionWins, activePosition } = useTradeStore();
  const tradeHistory = useTradeStore((s) => s.tradeHistory);
  const { activePhantoms, resolvedPhantoms } = usePhantomStore();
  const {
    antiYouSessionPnl, evolution, profile,
    shadowPositions, shadowSessionTrades, shadowSessionWins,
  } = useAntiYouStore();
  const { arenaScreenShakeEnabled } = useSettingsStore();
  const { score: tiltScore, zone: tiltZone } = useTiltStore();
  const { fighterMode, selectedHero, selectedSprite, selectedRingTheme, openCustomize } = useHeroStore();

  const ringRef = useRef<HTMLDivElement>(null);
  const [spriteSize, setSpriteSize] = useState(200);
  useEffect(() => {
    const update = () => {
      if (ringRef.current) {
        setSpriteSize(Math.round(ringRef.current.offsetHeight * 0.82));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    if (ringRef.current) ro.observe(ringRef.current);
    return () => ro.disconnect();
  }, []);

  const hero = HEROES[selectedHero];
  const spriteChar = SPRITE_CHARACTERS[selectedSprite];
  const ringTheme = RING_THEMES[selectedRingTheme];
  const isSprite = fighterMode === "sprite";
  const mainColor = isSprite ? spriteChar.color : hero.color;
  const villainColor = isSprite ? spriteChar.villainColor : hero.villainAccent;
  const tiltColor = TILT_ZONE_COLORS[tiltZone];
  const rankInfo = useMemo(
    () => xpToRank(calculateEstimatedXp(tradeHistory, [...activePhantoms, ...resolvedPhantoms])),
    [tradeHistory, activePhantoms, resolvedPhantoms]
  );

  const winRate = useMemo(() => {
    if (sessionTrades === 0) return 0;
    return Math.round((sessionWins / sessionTrades) * 100);
  }, [sessionTrades, sessionWins]);

  const shadowWinRate = useMemo(() => {
    if (shadowSessionTrades === 0) return 0;
    return Math.round((shadowSessionWins / shadowSessionTrades) * 100);
  }, [shadowSessionTrades, shadowSessionWins]);

  const liveShadowPnl = useMemo(() => {
    return shadowPositions
      .filter((p) => p.status === "open")
      .reduce((sum, p) => sum + p.currentPnl, 0);
  }, [shadowPositions]);

  const activeSpecCount = useMemo(() => {
    return shadowPositions.filter((p) => p.status === "open" && p.userTradeId.startsWith("spec_")).length;
  }, [shadowPositions]);

  const topPattern = profile?.detectedPatterns?.[0] ?? null;

  const [eventFlash, setEventFlash] = useState<{
    label: string;
    color: string;
    id: string;
  } | null>(null);

  const [ringFlash, setRingFlash] = useState(false);
  const heavyActions: FighterAction[] = ["uppercut", "body-blow", "hook", "stagger", "ko"];
  const isHeavyHit = heavyActions.includes(yourAction) || heavyActions.includes(antiYouAction);

  useEffect(() => {
    if (!activeEvent) return;

    setEventFlash({
      label: getEventLabel(activeEvent.type),
      color: EVENT_COLORS[activeEvent.type],
      id: activeEvent.id,
    });

    setRingFlash(true);
    const flashT = setTimeout(() => setRingFlash(false), 300);
    const t = setTimeout(() => setEventFlash(null), 1500);
    return () => { clearTimeout(t); clearTimeout(flashT); };
  }, [activeEvent]);

  const livePnlColor = activePosition
    ? (activePosition.currentPnl >= 0 ? "var(--color-success)" : "var(--color-danger)")
    : undefined;

  return (
    <>
      <HeroCustomizePopup />
      <div
        ref={ringRef}
        className={cn(
          "relative flex-shrink-0 select-none",
          arenaScreenShakeEnabled && isShaking && "screen-shake"
        )}
        style={{
          height: "clamp(240px, 34vh, 340px)",
          borderTop: "1px solid var(--color-border)",
          borderTopColor: tiltScore > 60 ? `${tiltColor}40` : undefined,
          transition: "border-color 3s ease",
          overflow: "hidden",
        }}
      >
        {/* Ring background - themed */}
        <div
          className="absolute inset-0"
          style={{ background: ringTheme.bgGradient }}
        />

        {/* Ring floor */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: "30%",
            background: ringTheme.floorGradient,
            borderTop: `1px solid ${ringTheme.ropeColor}`,
          }}
        />

        {/* Ring ropes - themed */}
        {[0.22, 0.44].map((pos, i) => (
          <div
            key={i}
            className="absolute left-0 right-0"
            style={{
              top: `${pos * 100}%`,
              height: 1,
              background: `linear-gradient(90deg,
                ${mainColor}20,
                ${ringTheme.ropeColor} 15%,
                ${ringTheme.ropeColor} 50%,
                ${ringTheme.ropeColor} 85%,
                ${villainColor}20
              )`,
              animation: `ring-rope-sway ${2 + i * 0.5}s ease-in-out infinite`,
            }}
          />
        ))}

        {/* Ring flash on heavy hits */}
        {ringFlash && isHeavyHit && (
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{ animation: "ring-flash 0.3s ease forwards", background: `${ringTheme.ambientColor}` }}
          />
        )}

        {/* Main layout: LEFT PANEL | FIGHTERS | RIGHT PANEL */}
        <div className="relative z-10 flex h-full">

          {/* LEFT: YOU panel */}
          <div
            className="flex-shrink-0 flex flex-col justify-between px-2 sm:px-3 py-2 h-full"
            style={{ width: "clamp(92px, 22vw, 180px)" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-md flex items-center justify-center text-[8px] sm:text-[9px] font-black flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${mainColor}, ${mainColor}BB)`,
                  color: "#000",
                  boxShadow: `0 0 8px ${mainColor}30`,
                }}
              >
                YOU
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded truncate"
                    style={{ color: rankInfo.color, background: `${rankInfo.color}18` }}
                  >
                    {formatRank(rankInfo)}
                  </span>
                </div>
                <HealthBar health={yourHealth} side="left" color={mainColor} />
              </div>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <StatRow
                label="Session P&L"
                value={formatCurrency(sessionPnl)}
                color={sessionPnl >= 0 ? "var(--color-success)" : "var(--color-danger)"}
              />
              {activePosition && (
                <StatRow
                  label="Live P&L"
                  value={formatCurrency(activePosition.currentPnl)}
                  color={livePnlColor}
                />
              )}
              <StatRow label="Win Rate" value={`${winRate}%`} color={winRate >= 50 ? "var(--color-success)" : "var(--color-danger)"} />
              <StatRow label="Trades" value={`${sessionWins}/${sessionTrades}`} />
              <StatRow
                label="Streak"
                value={winStreak > 0 ? `${winStreak}W` : lossStreak > 0 ? `${lossStreak}L` : "—"}
                color={winStreak > 0 ? "var(--color-success)" : lossStreak > 0 ? "var(--color-danger)" : undefined}
              />
              <StatRow label="Tilt" value={`${tiltScore}`} color={tiltColor} />
            </div>
          </div>

          {/* CENTER: Ring with fighters — vertically centered */}
          <div className="flex-1 relative flex flex-col items-center justify-center min-w-0 overflow-visible gap-1 px-1 sm:px-0">
            {/* Round + record */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 z-20">
              <span className="text-[10px] sm:text-[11px] font-mono tracking-wider uppercase" style={{ color: mainColor }}>
                R{round}
              </span>
              <span className="text-[8px] sm:text-[9px] text-[var(--color-text-muted)] font-mono tabular-nums opacity-70 whitespace-nowrap">
                {sessionRecord.wins}W-{sessionRecord.losses}L-{sessionRecord.draws}D
              </span>
            </div>

            <AnimatePresence>
              {comboCount >= 3 && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute left-1/2 -translate-x-1/2 top-5 z-20 pointer-events-none"
                >
                  <span className="text-[11px] sm:text-[13px] font-black tracking-wider whitespace-nowrap" style={{ color: mainColor }}>
                    COMBO x{comboCount}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fighter names — absolutely inside the ring near the floor */}
            <div className="absolute bottom-2 sm:bottom-4 left-2 right-2 sm:left-0 sm:right-0 flex items-end justify-between sm:justify-center gap-2 sm:gap-12 z-10 pointer-events-none">
              <span
                className="max-w-[42%] sm:max-w-none text-[10px] sm:text-sm leading-tight font-black uppercase tracking-[0.18em] sm:tracking-widest break-words text-left"
                style={{ color: mainColor, textShadow: `0 0 12px ${mainColor}60` }}
              >
                {isSprite ? spriteChar.name : hero.name}
              </span>
              <span className="text-[8px] sm:text-[10px] font-bold text-white/30 uppercase shrink-0 self-center">VS</span>
              <span
                className="max-w-[42%] sm:max-w-none text-[10px] sm:text-sm leading-tight font-black uppercase tracking-[0.18em] sm:tracking-widest break-words text-right"
                style={{ color: villainColor, textShadow: `0 0 12px ${villainColor}60` }}
              >
                {isSprite ? `Anti-${spriteChar.name}` : hero.villainName}
              </span>
            </div>

            {/* Fighters row */}
            <div className="flex items-center justify-center overflow-visible">
              {/* YOUR FIGHTER */}
              <div className="relative" style={{ marginRight: 6 }}>
                {isSprite ? (
                  <SpriteAnimator
                    character={spriteChar}
                    action={yourAction}
                    isVillain={false}
                    health={yourHealth}
                    width={spriteSize}
                    height={spriteSize}
                    onClick={openCustomize}
                  />
                ) : (
                  <AnimeHeroFighter
                    hero={hero}
                    isVillain={false}
                    action={yourAction}
                    health={yourHealth}
                    onClick={openCustomize}
                  />
                )}
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: 76, height: 8, background: `radial-gradient(ellipse, ${mainColor}25, transparent)` }}
                />
              </div>

              <AnimatePresence>
                {eventFlash && (
                  <motion.div
                    key={eventFlash.id}
                    initial={{ scale: 0.3, rotate: -15, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 1.8, opacity: 0 }}
                    transition={{ type: "spring", damping: 12, stiffness: 300 }}
                    className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none text-center"
                  >
                    <div
                      className="absolute inset-0 rounded-full -m-4 opacity-20"
                      style={{ background: `radial-gradient(circle, ${eventFlash.color}, transparent)` }}
                    />
                    <span
                      className="text-2xl font-black tracking-tight drop-shadow-lg whitespace-nowrap"
                      style={{
                        color: eventFlash.color,
                        textShadow: `0 0 16px ${eventFlash.color}, 0 0 32px ${eventFlash.color}60`,
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {eventFlash.label}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* VILLAIN FIGHTER */}
              <div className="relative" style={{ marginLeft: 6 }}>
                {isSprite ? (
                  <SpriteAnimator
                    character={spriteChar}
                    action={antiYouAction}
                    isVillain={true}
                    health={antiYouHealth}
                    width={spriteSize}
                    height={spriteSize}
                    onClick={openCustomize}
                  />
                ) : (
                  <AnimeHeroFighter
                    hero={hero}
                    isVillain={true}
                    action={antiYouAction}
                    health={antiYouHealth}
                    onClick={openCustomize}
                  />
                )}
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full"
                  style={{ width: 76, height: 8, background: `radial-gradient(ellipse, ${villainColor}25, transparent)` }}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: ANTI-YOU panel */}
          <div
            className="flex-shrink-0 flex flex-col justify-between px-2 sm:px-3 py-2 h-full"
            style={{ width: "clamp(92px, 22vw, 180px)" }}
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1 text-right">
                <HealthBar health={antiYouHealth} side="right" color={villainColor} />
              </div>
              <div
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-md flex items-center justify-center text-[8px] sm:text-[9px] font-black flex-shrink-0"
                style={{
                  background: "transparent",
                  color: "#fff",
                  border: `1px solid ${villainColor}50`,
                }}
              >
                AY
              </div>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <StatRow
                label="Shadow P&L"
                value={formatCurrency(antiYouSessionPnl + liveShadowPnl)}
                color={antiYouSessionPnl + liveShadowPnl >= 0 ? "var(--color-success)" : "var(--color-danger)"}
              />
              {liveShadowPnl !== 0 && (
                <StatRow
                  label="Live"
                  value={formatCurrency(liveShadowPnl)}
                  color={liveShadowPnl >= 0 ? "var(--color-success)" : "var(--color-danger)"}
                />
              )}
              <StatRow
                label="Win Rate"
                value={`${shadowWinRate}%`}
                color={shadowWinRate >= 50 ? "var(--color-success)" : "var(--color-danger)"}
              />
              <StatRow label="Trades" value={`${shadowSessionWins}/${shadowSessionTrades}`} />
              <EvolutionProgress evolution={evolution} totalTrades={profile?.totalTrades ?? 0} />
              {activeSpecCount > 0 && (
                <div className="flex items-center justify-between text-[9px] leading-tight">
                  <span style={{ color: villainColor }} className="uppercase tracking-wider font-bold animate-pulse">SPECULATING</span>
                  <span style={{ color: villainColor }} className="font-bold tabular-nums">{activeSpecCount} open</span>
                </div>
              )}
              <StatRow
                label="Δ P&L"
                value={formatCurrency(sessionPnl - (antiYouSessionPnl + liveShadowPnl))}
                color={sessionPnl >= antiYouSessionPnl + liveShadowPnl ? "var(--color-success)" : "var(--color-danger)"}
              />
              {topPattern && (
                <div className="text-[8px] leading-tight truncate opacity-80 text-right" style={{ color: villainColor }} title={topPattern}>
                  {topPattern}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session result overlay */}
        <AnimatePresence>
          {sessionResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
            >
              <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)", animation: "ko-flash 1s ease infinite" }} />
              <div className="text-center">
                <span
                  className="text-4xl font-black tracking-tight drop-shadow-lg"
                  style={{
                    color: sessionResult === "win" ? mainColor : sessionResult === "loss" ? villainColor : "#FBBF24",
                    textShadow: `0 0 30px ${sessionResult === "win" ? mainColor : sessionResult === "loss" ? villainColor : "#FBBF24"}`,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  {sessionResult === "win" ? "K.O.!!" : sessionResult === "loss" ? "DEFEATED" : "DRAW"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {tiltScore > 60 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-px opacity-60 z-20"
            style={{
              background: `linear-gradient(90deg, transparent, ${tiltColor}, transparent)`,
              animation: "tilt-pulse 1s ease-in-out infinite",
            }}
          />
        )}
      </div>
    </>
  );
}
