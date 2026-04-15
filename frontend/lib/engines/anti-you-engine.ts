"use strict";

import { nanoid } from "nanoid";
import { subscribeTicks, type TickEvent } from "@/lib/deriv/tick-bus";
import { useAntiYouStore, type AntiYouEvolution } from "@/lib/stores/anti-you-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { useArenaStore } from "@/lib/stores/arena-store";
import { useSessionStore } from "@/lib/stores/session-store";
import { shadowTradeRepo } from "@/lib/db/repositories";
import type { TradeDirection, ShadowTrade } from "@/lib/db/schema";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BehavioralProfile {
  totalTrades: number;
  assetFrequency: Record<string, number>;
  directionBias: Record<string, number>;
  avgStake: number;
  stakeAfterLoss: number;
  stakeAfterWin: number;
  avgHoldDurationMs: number;
  earlyExitRate: number;
  timeOfDayBuckets: number[];
  winRateByAsset: Record<string, { wins: number; total: number }>;
  winRateByTiltZone: Record<string, { wins: number; total: number }>;
  avgReentryAfterLossMs: number;
  lastTradeDirection: TradeDirection | null;
  lastTradeWon: boolean;
  consecutiveLosses: number;
  lastTradeTimestamp: number;
  detectedPatterns: string[];
}

export interface ShadowPosition {
  id: string;
  userTradeId: string;
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  entrySpot: number;
  currentSpot: number;
  currentPnl: number;
  startTime: number;
  expiryTime: number;
  status: "open" | "won" | "lost";
  exitSpot?: number;
  finalPnl?: number;
  closedAt?: number;
  strategy: AntiYouEvolution;
  reasoning: string;
}

interface UserTradeParams {
  id: string;
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  duration: number;
  durationUnit: string;
  tiltScore: number;
  entrySpot: number;
}

interface UserTradeResult {
  id: string;
  won: boolean;
  pnl: number;
  exitSpot: number;
  heldToExpiry: boolean;
  durationMs: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getExpiryMs(duration: number, unit: string): number {
  switch (unit) {
    case "s": return duration * 1000;
    case "m": return duration * 60_000;
    case "h": return duration * 3_600_000;
    default:  return duration * 60_000;
  }
}

function flipDirection(dir: TradeDirection): TradeDirection {
  return dir === "CALL" ? "PUT" : "CALL";
}

function calculateShadowPnl(
  direction: TradeDirection,
  entrySpot: number,
  currentSpot: number,
  stake: number,
): number {
  if (entrySpot === 0) return 0;
  const payout = stake * 0.85;
  const diff = currentSpot - entrySpot;
  const sign = direction === "CALL" ? 1 : -1;
  const movement = diff * sign;
  const sensitivity = entrySpot * 0.001;
  const ratio = Math.max(-1, Math.min(1, movement / sensitivity));
  return ratio >= 0 ? payout * ratio : stake * ratio;
}

function getEvolutionForTradeCount(count: number): AntiYouEvolution {
  if (count < 5)  return "SIMPLE_MIRROR";
  if (count < 15) return "PATTERN_MIRROR";
  if (count < 30) return "BEHAVIORAL_MIRROR";
  return "FULL_INVERSE";
}

function getTiltZoneLabel(score: number): string {
  if (score < 20) return "COMPOSED";
  if (score < 40) return "WARMING";
  if (score < 60) return "TILTING";
  if (score < 80) return "ON_TILT";
  return "MELTDOWN";
}

// ── Profile ──────────────────────────────────────────────────────────────────

function createEmptyProfile(): BehavioralProfile {
  return {
    totalTrades: 0,
    assetFrequency: {},
    directionBias: {},
    avgStake: 0,
    stakeAfterLoss: 0,
    stakeAfterWin: 0,
    avgHoldDurationMs: 0,
    earlyExitRate: 0,
    timeOfDayBuckets: new Array(24).fill(0),
    winRateByAsset: {},
    winRateByTiltZone: {},
    avgReentryAfterLossMs: 0,
    lastTradeDirection: null,
    lastTradeWon: true,
    consecutiveLosses: 0,
    lastTradeTimestamp: 0,
    detectedPatterns: [],
  };
}

// ── Engine State ─────────────────────────────────────────────────────────────

let profile: BehavioralProfile = createEmptyProfile();
const activeShadows = new Map<string, {
  position: ShadowPosition;
  unsubscribeTicks: (() => void) | null;
  expiryTimeout: ReturnType<typeof setTimeout> | null;
}>();

let totalStakeSum = 0;
let afterLossStakeSum = 0;
let afterLossStakeCount = 0;
let afterWinStakeSum = 0;
let afterWinStakeCount = 0;
let holdDurationSum = 0;
let holdDurationCount = 0;
let earlyExitCount = 0;
let reentryAfterLossSum = 0;
let reentryAfterLossCount = 0;

// ── Profile Update ───────────────────────────────────────────────────────────

function updateProfileOnPlace(params: UserTradeParams): void {
  const p = profile;
  p.totalTrades++;

  p.assetFrequency[params.asset] = (p.assetFrequency[params.asset] ?? 0) + 1;

  const biasKey = `${params.asset}:${params.direction}`;
  p.directionBias[biasKey] = (p.directionBias[biasKey] ?? 0) + 1;

  totalStakeSum += params.stake;
  p.avgStake = totalStakeSum / p.totalTrades;

  if (p.lastTradeDirection !== null) {
    if (!p.lastTradeWon) {
      afterLossStakeSum += params.stake;
      afterLossStakeCount++;
      p.stakeAfterLoss = afterLossStakeSum / afterLossStakeCount;

      if (p.lastTradeTimestamp > 0) {
        const gap = Date.now() - p.lastTradeTimestamp;
        reentryAfterLossSum += gap;
        reentryAfterLossCount++;
        p.avgReentryAfterLossMs = reentryAfterLossSum / reentryAfterLossCount;
      }
    } else {
      afterWinStakeSum += params.stake;
      afterWinStakeCount++;
      p.stakeAfterWin = afterWinStakeSum / afterWinStakeCount;
    }
  }

  const hour = new Date().getHours();
  p.timeOfDayBuckets[hour]++;

  detectPatterns(p);

  syncProfileToStore();
}

function updateProfileOnResolve(result: UserTradeResult): void {
  const p = profile;

  // find the shadow position linked to this user trade id
  const shadow = Array.from(activeShadows.values()).find(
    (entry) => entry.position.userTradeId === result.id
  );
  const asset = shadow?.position.asset ?? "unknown";
  if (!p.winRateByAsset[asset]) {
    p.winRateByAsset[asset] = { wins: 0, total: 0 };
  }
  p.winRateByAsset[asset].total++;
  if (result.won) p.winRateByAsset[asset].wins++;

  const tiltZone = getTiltZoneLabel(useTiltStore.getState().score);
  if (!p.winRateByTiltZone[tiltZone]) {
    p.winRateByTiltZone[tiltZone] = { wins: 0, total: 0 };
  }
  p.winRateByTiltZone[tiltZone].total++;
  if (result.won) p.winRateByTiltZone[tiltZone].wins++;

  holdDurationSum += result.durationMs;
  holdDurationCount++;
  p.avgHoldDurationMs = holdDurationSum / holdDurationCount;

  if (!result.heldToExpiry) {
    earlyExitCount++;
  }
  p.earlyExitRate = p.totalTrades > 0 ? earlyExitCount / p.totalTrades : 0;

  p.lastTradeWon = result.won;
  p.consecutiveLosses = result.won ? 0 : p.consecutiveLosses + 1;
  p.lastTradeTimestamp = Date.now();

  detectPatterns(p);

  const evolution = getEvolutionForTradeCount(p.totalTrades);
  useAntiYouStore.getState().setEvolution(evolution);

  syncProfileToStore();
}

// ── Pattern Detection ────────────────────────────────────────────────────────

function detectPatterns(p: BehavioralProfile): void {
  const patterns: string[] = [];

  // Direction bias: if > 70% of trades on any asset go one way
  const assetTotals: Record<string, number> = {};
  for (const [key, count] of Object.entries(p.directionBias)) {
    const asset = key.split(":")[0];
    assetTotals[asset] = (assetTotals[asset] ?? 0) + count;
  }
  for (const [key, count] of Object.entries(p.directionBias)) {
    const [asset, dir] = key.split(":");
    const total = assetTotals[asset] ?? 1;
    if (total >= 3 && count / total > 0.7) {
      patterns.push(`${dir} bias on ${asset} (${Math.round(count / total * 100)}%)`);
    }
  }

  // Revenge trading: stake after loss significantly higher than average
  if (p.stakeAfterLoss > 0 && p.avgStake > 0 && p.stakeAfterLoss > p.avgStake * 1.3) {
    patterns.push(`Stake escalation after loss (+${Math.round((p.stakeAfterLoss / p.avgStake - 1) * 100)}%)`);
  }

  // Rapid re-entry after loss
  if (p.avgReentryAfterLossMs > 0 && p.avgReentryAfterLossMs < 30_000) {
    patterns.push(`Rapid re-entry after loss (${Math.round(p.avgReentryAfterLossMs / 1000)}s avg)`);
  }

  // High early exit rate
  if (p.totalTrades >= 5 && p.earlyExitRate > 0.4) {
    patterns.push(`High early exit rate (${Math.round(p.earlyExitRate * 100)}%)`);
  }

  // Time-of-day clustering
  const maxBucket = Math.max(...p.timeOfDayBuckets);
  if (maxBucket >= 3 && p.totalTrades >= 5) {
    const peakHour = p.timeOfDayBuckets.indexOf(maxBucket);
    const pct = Math.round((maxBucket / p.totalTrades) * 100);
    if (pct > 40) {
      patterns.push(`Clusters trades around ${peakHour}:00 (${pct}%)`);
    }
  }

  // Asset concentration
  const sortedAssets = Object.entries(p.assetFrequency).sort((a, b) => b[1] - a[1]);
  if (sortedAssets.length > 0 && p.totalTrades >= 5) {
    const topPct = Math.round((sortedAssets[0][1] / p.totalTrades) * 100);
    if (topPct > 60) {
      patterns.push(`Over-concentrates on ${sortedAssets[0][0]} (${topPct}%)`);
    }
  }

  // Losing on tilt
  const tiltZones = ["ON_TILT", "MELTDOWN"];
  let tiltWins = 0, tiltTotal = 0;
  for (const zone of tiltZones) {
    const data = p.winRateByTiltZone[zone];
    if (data) {
      tiltWins += data.wins;
      tiltTotal += data.total;
    }
  }
  if (tiltTotal >= 3) {
    const tiltWinRate = tiltWins / tiltTotal;
    if (tiltWinRate < 0.35) {
      patterns.push(`Loses ${Math.round((1 - tiltWinRate) * 100)}% when tilted`);
    }
  }

  p.detectedPatterns = patterns;
}

function syncProfileToStore(): void {
  const store = useAntiYouStore.getState();
  store.setProfile({ ...profile });
}

// ── Strategy Picker ──────────────────────────────────────────────────────────

function getSimpleMirrorPosition(
  params: UserTradeParams,
): Pick<ShadowPosition, "direction" | "stake" | "reasoning"> {
  return {
    direction: flipDirection(params.direction),
    stake: params.stake,
    reasoning: "Simple mirror: exact opposite direction, same stake",
  };
}

function getPatternMirrorPosition(
  params: UserTradeParams,
  p: BehavioralProfile,
): Pick<ShadowPosition, "direction" | "stake" | "reasoning"> | null {
  const biasKey = `${params.asset}:${params.direction}`;
  const assetTotal = (p.assetFrequency[params.asset] ?? 0);
  const dirCount = p.directionBias[biasKey] ?? 0;
  const biasRatio = assetTotal > 0 ? dirCount / assetTotal : 0.5;

  // Higher stake when user follows their known bias (they're predictable)
  const stakeMultiplier = biasRatio > 0.6 ? 1 + (biasRatio - 0.5) : 1;
  const reasons: string[] = [];

  if (biasRatio > 0.6) {
    reasons.push(`detected ${Math.round(biasRatio * 100)}% ${params.direction} bias on ${params.asset}`);
  }

  return {
    direction: flipDirection(params.direction),
    stake: Math.round(params.stake * stakeMultiplier * 100) / 100,
    reasoning: reasons.length > 0
      ? `Pattern mirror: ${reasons.join(", ")}`
      : "Pattern mirror: inverse direction with profile-weighted sizing",
  };
}

function getBehavioralMirrorPosition(
  params: UserTradeParams,
  p: BehavioralProfile,
  tiltScore: number,
): Pick<ShadowPosition, "direction" | "stake" | "reasoning"> | null {
  const base = getPatternMirrorPosition(params, p);
  if (!base) return null;

  const reasons: string[] = [base.reasoning];
  let stakeMultiplier = 1;

  // Increase stake when user is tilted — they make worse decisions
  if (tiltScore > 60) {
    stakeMultiplier += (tiltScore - 60) / 100;
    reasons.push(`tilt-boosted stake (+${Math.round((stakeMultiplier - 1) * 100)}% for tilt ${tiltScore})`);
  }

  // Increase when user is on a losing streak and escalating
  if (p.consecutiveLosses >= 2 && params.stake > p.avgStake * 1.2) {
    stakeMultiplier += 0.3;
    reasons.push(`revenge pattern: ${p.consecutiveLosses} consecutive losses + elevated stake`);
  }

  return {
    direction: base.direction,
    stake: Math.round(base.stake * stakeMultiplier * 100) / 100,
    reasoning: `Behavioral mirror: ${reasons.join("; ")}`,
  };
}

function getFullInversePosition(
  params: UserTradeParams,
  p: BehavioralProfile,
  tiltScore: number,
): Pick<ShadowPosition, "direction" | "stake" | "reasoning"> | null {
  const assetStats = p.winRateByAsset[params.asset];
  const assetWinRate = assetStats && assetStats.total >= 3
    ? assetStats.wins / assetStats.total
    : 0.5;

  const tiltZone = getTiltZoneLabel(tiltScore);
  const tiltStats = p.winRateByTiltZone[tiltZone];
  const tiltWinRate = tiltStats && tiltStats.total >= 2
    ? tiltStats.wins / tiltStats.total
    : 0.5;

  // Skip trades where user historically wins > 60% in calm state
  if (assetWinRate > 0.6 && tiltScore < 30) {
    return null;
  }

  const base = getBehavioralMirrorPosition(params, p, tiltScore);
  if (!base) return null;

  const reasons: string[] = [];

  // Double down where user historically loses
  let selectiveMultiplier = 1;
  if (assetWinRate < 0.4) {
    selectiveMultiplier += 0.5;
    reasons.push(`user loses ${Math.round((1 - assetWinRate) * 100)}% on ${params.asset}`);
  }
  if (tiltWinRate < 0.4) {
    selectiveMultiplier += 0.3;
    reasons.push(`user loses ${Math.round((1 - tiltWinRate) * 100)}% in ${tiltZone} state`);
  }

  return {
    direction: base.direction,
    stake: Math.round(base.stake * selectiveMultiplier * 100) / 100,
    reasoning: `Full inverse: selective counter — ${reasons.length > 0 ? reasons.join("; ") : "standard inverse"}. ${base.reasoning}`,
  };
}

function pickStrategy(
  params: UserTradeParams,
): Pick<ShadowPosition, "direction" | "stake" | "reasoning"> | null {
  const evolution = getEvolutionForTradeCount(profile.totalTrades);
  const tiltScore = params.tiltScore;

  switch (evolution) {
    case "SIMPLE_MIRROR":
      return getSimpleMirrorPosition(params);
    case "PATTERN_MIRROR":
      return getPatternMirrorPosition(params, profile);
    case "BEHAVIORAL_MIRROR":
      return getBehavioralMirrorPosition(params, profile, tiltScore);
    case "FULL_INVERSE":
      return getFullInversePosition(params, profile, tiltScore);
    default:
      return getSimpleMirrorPosition(params);
  }
}

// ── Shadow Position Lifecycle ────────────────────────────────────────────────

function openShadowPosition(
  params: UserTradeParams,
  strategy: Pick<ShadowPosition, "direction" | "stake" | "reasoning">,
  durationMs: number,
): void {
  const evolution = getEvolutionForTradeCount(profile.totalTrades);
  const now = Date.now();
  const shadowId = nanoid();

  const position: ShadowPosition = {
    id: shadowId,
    userTradeId: params.id,
    asset: params.asset,
    assetDisplayName: params.assetDisplayName,
    direction: strategy.direction,
    stake: strategy.stake,
    entrySpot: params.entrySpot,
    currentSpot: params.entrySpot,
    currentPnl: 0,
    startTime: now,
    expiryTime: now + durationMs,
    status: "open",
    strategy: evolution,
    reasoning: strategy.reasoning,
  };

  const unsubscribeTicks = subscribeTicks(params.asset, (tick: TickEvent) => {
    const shadow = activeShadows.get(shadowId);
    if (!shadow || shadow.position.status !== "open") return;

    shadow.position.currentSpot = tick.quote;
    shadow.position.currentPnl = calculateShadowPnl(
      shadow.position.direction,
      shadow.position.entrySpot,
      tick.quote,
      shadow.position.stake,
    );

    syncShadowsToStore();
  });

  const expiryTimeout = setTimeout(() => {
    resolveShadowPosition(shadowId);
  }, durationMs);

  activeShadows.set(shadowId, { position, unsubscribeTicks, expiryTimeout });

  syncShadowsToStore();
}

function resolveShadowPosition(shadowId: string): void {
  const entry = activeShadows.get(shadowId);
  if (!entry || entry.position.status !== "open") return;

  const pos = entry.position;

  if (entry.expiryTimeout) clearTimeout(entry.expiryTimeout);
  if (entry.unsubscribeTicks) entry.unsubscribeTicks();

  const exitSpot = pos.currentSpot;
  const won = pos.direction === "CALL"
    ? exitSpot > pos.entrySpot
    : exitSpot < pos.entrySpot;
  const finalPnl = won ? pos.stake * 0.85 : -pos.stake;

  pos.status = won ? "won" : "lost";
  pos.exitSpot = exitSpot;
  pos.finalPnl = finalPnl;
  pos.closedAt = Date.now();

  // Update Anti-You session P&L
  const store = useAntiYouStore.getState();
  const newAntiYouPnl = store.antiYouSessionPnl + finalPnl;
  store.updateEquityCurves(store.yourSessionPnl, newAntiYouPnl);

  // Add to shadow history
  store.addShadowToHistory(pos);

  // Persist to IndexedDB
  const sessionId = useSessionStore.getState().currentSession?.id ?? "demo";
  const shadowRecord: ShadowTrade = {
    id: pos.id,
    userTradeId: pos.userTradeId,
    sessionId,
    asset: pos.asset,
    assetDisplayName: pos.assetDisplayName,
    direction: pos.direction,
    stake: pos.stake,
    entrySpot: pos.entrySpot,
    exitSpot,
    finalPnl,
    startTime: pos.startTime,
    expiryTime: pos.expiryTime,
    closedAt: pos.closedAt,
    status: pos.status as "won" | "lost",
    strategy: pos.strategy,
    reasoning: pos.reasoning,
  };
  shadowTradeRepo.save(shadowRecord).catch(() => {});

  // Arena interaction: scaled damage based on P&L magnitude
  const arena = useArenaStore.getState();
  const damage = Math.min(15, Math.max(3, Math.abs(finalPnl) / pos.stake * 10));

  if (won) {
    // Anti-You's trade won = Anti-You punches you
    arena.triggerFight("hit", "hook");
    arena.adjustYourHealth(-damage);
    arena.adjustAntiYouHealth(Math.round(damage * 0.3));
  } else {
    // Anti-You's trade lost = you punch Anti-You
    arena.triggerFight("jab", "hit");
    arena.adjustAntiYouHealth(-damage);
    arena.adjustYourHealth(Math.round(damage * 0.3));
  }

  // Clean up after a delay so UI can show final state
  setTimeout(() => {
    activeShadows.delete(shadowId);
    syncShadowsToStore();
  }, 2000);

  syncShadowsToStore();
}

function syncShadowsToStore(): void {
  const positions: ShadowPosition[] = [];
  activeShadows.forEach(({ position }) => positions.push({ ...position }));
  useAntiYouStore.getState().setShadowPositions(positions);
}

// ── Proactive Speculation (trades while user is just browsing) ───────────────

const SPECULATION_INTERVAL_MS = 45_000;
const SPECULATION_DURATION_MS = 2 * 60_000;
const MAX_CONCURRENT_SPECULATIONS = 2;
const MIN_TRADES_FOR_SPECULATION = 5;

let speculationTimer: ReturnType<typeof setInterval> | null = null;
let lastSpeculationTime = 0;

function canSpeculate(): boolean {
  const evolution = getEvolutionForTradeCount(profile.totalTrades);
  if (evolution === "SIMPLE_MIRROR") return false;
  if (profile.totalTrades < MIN_TRADES_FOR_SPECULATION) return false;

  const openSpeculations = Array.from(activeShadows.values())
    .filter((s) => s.position.userTradeId.startsWith("spec_"));
  if (openSpeculations.length >= MAX_CONCURRENT_SPECULATIONS) return false;

  if (Date.now() - lastSpeculationTime < SPECULATION_INTERVAL_MS) return false;

  return true;
}

function buildSpeculativePosition(): {
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  reasoning: string;
} | null {
  const p = profile;
  const tradeState = useTradeStore.getState();

  if (tradeState.activePosition) return null;

  const browsedAsset = tradeState.selectedAsset;
  const browsedDirection = tradeState.selectedDirection;
  const browsedDisplayName =
    tradeState.availableSymbols.find((s) => s.symbol === browsedAsset)?.display_name ?? browsedAsset;

  const tiltScore = useTiltStore.getState().score;
  const evolution = getEvolutionForTradeCount(p.totalTrades);
  const reasons: string[] = [];

  // Predict what the user would do and counter it
  let predictedDirection: TradeDirection = browsedDirection;
  let confidence = 0.5;

  // Use browsed direction as baseline — if user is looking at CALL, they likely go CALL
  confidence += 0.1;
  reasons.push(`user browsing ${browsedDirection} on ${browsedAsset}`);

  // Boost confidence if this matches their known bias
  const biasKey = `${browsedAsset}:${browsedDirection}`;
  const assetTotal = p.assetFrequency[browsedAsset] ?? 0;
  const dirCount = p.directionBias[biasKey] ?? 0;
  if (assetTotal >= 3) {
    const biasRatio = dirCount / assetTotal;
    if (biasRatio > 0.6) {
      confidence += (biasRatio - 0.5) * 0.5;
      reasons.push(`${Math.round(biasRatio * 100)}% historical ${browsedDirection} bias`);
    }
  }

  // Boost if user is on tilt — they're more predictable
  if (tiltScore > 60) {
    confidence += 0.15;
    reasons.push(`user tilted (${tiltScore})`);
  }

  // After losses, user tends to repeat or revenge trade
  if (!p.lastTradeWon && p.consecutiveLosses >= 1 && p.lastTradeDirection) {
    predictedDirection = p.lastTradeDirection;
    confidence += 0.1;
    reasons.push(`post-loss: likely repeating ${predictedDirection}`);
  }

  // Only speculate if we're reasonably confident
  const minConfidence = evolution === "FULL_INVERSE" ? 0.55 : 0.65;
  if (confidence < minConfidence) return null;

  // Stake is a fraction of user's average — speculative bets are smaller
  let stakeMultiplier = 0.5;
  if (tiltScore > 60) stakeMultiplier = 0.8;
  if (evolution === "FULL_INVERSE") stakeMultiplier = 0.7;
  const stake = Math.max(1, Math.round(p.avgStake * stakeMultiplier * 100) / 100);

  return {
    asset: browsedAsset,
    assetDisplayName: browsedDisplayName,
    direction: flipDirection(predictedDirection),
    stake,
    reasoning: `Speculative (${evolution}): ${reasons.join("; ")} — confidence ${Math.round(confidence * 100)}%`,
  };
}

function runSpeculation(): void {
  if (!canSpeculate()) return;

  const spec = buildSpeculativePosition();
  if (!spec) return;

  lastSpeculationTime = Date.now();

  // We need an entry spot from the tick stream — subscribe and take the first tick
  let gotEntry = false;
  const tempUnsub = subscribeTicks(spec.asset, (tick: TickEvent) => {
    if (gotEntry) return;
    gotEntry = true;

    // Clean up the temp subscription on next tick
    setTimeout(() => tempUnsub(), 0);

    const specParams: UserTradeParams = {
      id: `spec_${nanoid()}`,
      asset: spec.asset,
      assetDisplayName: spec.assetDisplayName,
      direction: spec.direction,
      stake: spec.stake,
      duration: 2,
      durationUnit: "m",
      tiltScore: useTiltStore.getState().score,
      entrySpot: tick.quote,
    };

    openShadowPosition(
      specParams,
      { direction: spec.direction, stake: spec.stake, reasoning: spec.reasoning },
      SPECULATION_DURATION_MS,
    );
  });

  // Safety: if no tick arrives within 5s, clean up
  setTimeout(() => {
    if (!gotEntry) tempUnsub();
  }, 5000);
}

export function startProactiveLoop(): void {
  if (speculationTimer) return;
  speculationTimer = setInterval(runSpeculation, SPECULATION_INTERVAL_MS);
}

export function stopProactiveLoop(): void {
  if (speculationTimer) {
    clearInterval(speculationTimer);
    speculationTimer = null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export function onUserTradePlaced(params: UserTradeParams): void {
  updateProfileOnPlace(params);

  const strategy = pickStrategy(params);
  if (!strategy) {
    // Full inverse may skip trades where user historically wins
    return;
  }

  const durationMs = getExpiryMs(params.duration, params.durationUnit);
  openShadowPosition(params, strategy, durationMs);
}

export function onUserTradeResolved(result: UserTradeResult): void {
  updateProfileOnResolve(result);

  const store = useAntiYouStore.getState();
  const yourPnl = useTradeStore.getState().sessionPnl;
  store.updateEquityCurves(yourPnl, store.antiYouSessionPnl);
}

export function getProfile(): BehavioralProfile {
  return { ...profile };
}

export function getActiveShadowPositions(): ShadowPosition[] {
  const positions: ShadowPosition[] = [];
  activeShadows.forEach(({ position }) => positions.push({ ...position }));
  return positions;
}

export function resetAntiYouEngine(): void {
  stopProactiveLoop();

  activeShadows.forEach(({ unsubscribeTicks, expiryTimeout }) => {
    if (expiryTimeout) clearTimeout(expiryTimeout);
    if (unsubscribeTicks) unsubscribeTicks();
  });
  activeShadows.clear();

  profile = createEmptyProfile();
  totalStakeSum = 0;
  afterLossStakeSum = 0;
  afterLossStakeCount = 0;
  afterWinStakeSum = 0;
  afterWinStakeCount = 0;
  holdDurationSum = 0;
  holdDurationCount = 0;
  earlyExitCount = 0;
  reentryAfterLossSum = 0;
  reentryAfterLossCount = 0;
  lastSpeculationTime = 0;

  syncProfileToStore();
  syncShadowsToStore();
}
