"use client";

import { nanoid } from "nanoid";
import { subscribeTicks } from "@/lib/deriv/tick-bus";
import { derivTradingWS } from "@/lib/deriv/trading-ws";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useSessionStore } from "@/lib/stores/session-store";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { useArenaStore } from "@/lib/stores/arena-store";
import { tradeRepo } from "@/lib/db/repositories";
import { fireArenaEvent } from "@/lib/engines/arena-events";
import { onUserTradePlaced, onUserTradeResolved } from "@/lib/engines/anti-you-engine";
import { evaluateAndCapture } from "@/lib/engines/phantom-tracker";
import {
  calculateEntryTilt,
  calculateExitTilt,
  applyTiltDecay,
} from "@/lib/engines/tilt-detection";
import type { Trade, TradeDirection } from "@/lib/db/schema";

/**
 * Update tilt on TRADE PLACEMENT (first tick received).
 * Applies time-based decay then evaluates all entry-behaviour signals.
 */
function onTradePlaced(asset: string, stake: number) {
  const tilt = useTiltStore.getState();
  const tradeState = useTradeStore.getState();
  const completedTrades = tradeState.tradeHistory.filter(
    (t) => t.status === "won" || t.status === "lost"
  );

  const now = Date.now();

  // Apply passive decay for time elapsed since last placement
  let baseScore = tilt.score;
  if (tilt.lastTradeTimestamp) {
    const minutesElapsed = (now - tilt.lastTradeTimestamp) / 60_000;
    if (minutesElapsed > 0) {
      baseScore = applyTiltDecay(tilt.score, minutesElapsed);
    }
  }

  // Stake escalation vs the most recent completed trade
  const lastCompletedTrade = completedTrades[0]; // newest-first
  const stakeEscalationRatio = lastCompletedTrade
    ? stake / lastCompletedTrade.stake
    : 1.0;
  const lastTradeWasLoss = lastCompletedTrade?.status === "lost";

  // Unfamiliar asset: no prior completed trade on this asset
  const knownAssets = new Set(completedTrades.map((t) => t.asset));
  const isUnfamiliarAsset =
    completedTrades.length > 0 && !knownAssets.has(asset);

  const result = calculateEntryTilt({
    currentScore: baseScore,
    consecutiveLosses: tilt.consecutiveLosses,
    timeSinceLastTradeMs: tilt.lastTradeTimestamp
      ? now - tilt.lastTradeTimestamp
      : null,
    timeSinceLastLossMs: tilt.lastLossTimestamp
      ? now - tilt.lastLossTimestamp
      : null,
    stakeEscalationRatio,
    lastTradeWasLoss,
    isUnfamiliarAsset,
    sessionPnl: tradeState.sessionPnl,
    viewingPhantomPortfolio: false,
    viewingTimeline: false,
  });

  tilt.setScore(result.score);
  tilt.addHistory({ timestamp: now, score: result.score, zone: result.zone });
  tilt.setLastTradeTimestamp(now);
}

/**
 * Update tilt on TRADE RESOLUTION (expiry or early sell).
 * Evaluates the quality of the EXIT decision — how you won/lost matters,
 * not just whether you won. Entry signals are never re-evaluated here.
 */
function onTradeResolved(won: boolean, heldToExpiry: boolean) {
  const tilt = useTiltStore.getState();
  const tradeState = useTradeStore.getState();
  const now = Date.now();
  const previousConsecutiveLosses = tilt.consecutiveLosses;

  // Update consecutive loss state BEFORE calculating exit tilt
  let updatedConsecutiveLosses = tilt.consecutiveLosses;
  if (won) {
    if (tilt.consecutiveLosses > 0) {
      updatedConsecutiveLosses = 0;
      tilt.setConsecutiveLosses(0);
    }
  } else {
    updatedConsecutiveLosses = tilt.consecutiveLosses + 1;
    tilt.setConsecutiveLosses(updatedConsecutiveLosses);
    tilt.setLastLossTimestamp(now);
  }

  const result = calculateExitTilt({
    currentScore: tilt.score,
    won,
    heldToExpiry,
    consecutiveLosses: updatedConsecutiveLosses,
    previousConsecutiveLosses,
    winStreak: tradeState.winStreak,
    sessionPnl: tradeState.sessionPnl,
  });

  tilt.setScore(result.score);
  tilt.addHistory({ timestamp: now, score: result.score, zone: result.zone });
}

interface SimulatedTrade {
  id: string;
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  entrySpot: number;
  duration: number;
  durationUnit: string;
  startTime: number;
  expiryTime: number;
  unsubscribeTicks: (() => void) | null;
  expiryTimeout: ReturnType<typeof setTimeout> | null;
  gotFirstTick: boolean;
  lastPnlSign: number;
  lastHitTime: number;
}

let activeSim: SimulatedTrade | null = null;

function getExpiryMs(duration: number, unit: string): number {
  switch (unit) {
    case "s": return duration * 1000;
    case "m": return duration * 60_000;
    case "h": return duration * 3_600_000;
    default:  return duration * 60_000;
  }
}

/**
 * For digital options, payout is typically 85% of stake.
 * P&L swings proportionally based on how far the spot has moved
 * relative to a "target movement" (derived from pip size).
 */
function calculateLivePnl(
  direction: TradeDirection,
  entrySpot: number,
  currentSpot: number,
  stake: number
): number {
  if (entrySpot === 0) return 0;
  const payout = stake * 0.85;
  const diff = currentSpot - entrySpot;
  const sign = direction === "CALL" ? 1 : -1;
  const movement = diff * sign;

  // scale movement to a -1..+1 range using entry spot as reference
  // a 0.1% move in the right direction = full payout territory
  const sensitivity = entrySpot * 0.001;
  const ratio = Math.max(-1, Math.min(1, movement / sensitivity));

  if (ratio >= 0) {
    return payout * ratio;
  }
  return stake * ratio;
}

let activeRealContractId: number | null = null;

async function placeRealTrade(params: {
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  duration: number;
  durationUnit: string;
}): Promise<{ success: boolean; error?: string }> {
  if (activeRealContractId) {
    return { success: false, error: "A real trade is already active." };
  }

  const tradeStore = useTradeStore.getState();
  const sessionStore = useSessionStore.getState();
  const tradeId = nanoid();
  const now = Date.now();
  const contractType = params.direction === "CALL" ? "CALL" : "PUT";

  try {
    if (!derivTradingWS.isConnected) {
      const reconnected = await derivTradingWS.connect();
      if (!reconnected) {
        return { success: false, error: "Could not connect to Deriv trading server. Falling back to simulation." };
      }
    }

    const proposal = await derivTradingWS.sendProposal({
      amount: params.stake,
      contractType,
      symbol: params.asset,
      duration: params.duration,
      durationUnit: params.durationUnit,
    });

    const buyResult = await derivTradingWS.sendBuy(
      proposal.proposalId,
      proposal.askPrice
    );

    activeRealContractId = buyResult.contractId;

    useAuthStore.getState().setBalance(buyResult.balanceAfter);

    const expiryMs = getExpiryMs(params.duration, params.durationUnit);

    tradeStore.setActivePosition({
      contractId: buyResult.contractId,
      asset: params.assetDisplayName,
      direction: params.direction,
      stake: buyResult.buyPrice,
      payout: buyResult.payout,
      entrySpot: 0,
      currentSpot: 0,
      currentPnl: 0,
      startTime: now,
      expiryTime: now + expiryMs,
      status: "open",
    });

    onTradePlaced(params.asset, params.stake);
    const tiltScoreAtEntry = useTiltStore.getState().score;

    const tradeRecord: Trade = {
      id: tradeId,
      sessionId: sessionStore.currentSession?.id ?? "demo",
      asset: params.asset,
      assetDisplayName: params.assetDisplayName,
      direction: params.direction,
      stake: buyResult.buyPrice,
      entrySpot: 0,
      duration: params.duration,
      durationUnit: params.durationUnit,
      timestamp: now,
      status: "active",
      tiltScoreAtEntry,
      wasRevengeFlag: tiltScoreAtEntry > 60,
      heldToExpiry: false,
    };
    tradeStore.addTrade(tradeRecord);
    tradeRepo.save(tradeRecord).catch(() => {});

    onUserTradePlaced({
      id: tradeId,
      asset: params.asset,
      assetDisplayName: params.assetDisplayName,
      direction: params.direction,
      stake: buyResult.buyPrice,
      duration: params.duration,
      durationUnit: params.durationUnit,
      tiltScore: tiltScoreAtEntry,
      entrySpot: 0,
    });

    derivTradingWS.subscribeOpenContract(buyResult.contractId, (data) => {
      const poc = data.proposal_open_contract as {
        entry_spot?: number;
        current_spot?: number;
        profit?: number;
        buy_price?: number;
        is_sold?: number;
        is_expired?: number;
        status?: string;
        sell_price?: number;
        contract_id?: number;
      } | undefined;

      if (!poc) return;

      const entrySpot = poc.entry_spot ?? 0;
      const currentSpot = poc.current_spot ?? 0;
      const currentPnl = poc.profit ?? 0;

      tradeStore.updateActivePosition({
        entrySpot,
        currentSpot,
        currentPnl,
      });

      if (entrySpot && tradeRecord.entrySpot === 0) {
        tradeRecord.entrySpot = entrySpot;
        tradeStore.updateTrade(tradeId, { entrySpot });
      }

      const isClosed = poc.is_sold === 1 || poc.is_expired === 1;
      if (isClosed) {
        const buyPrice = poc.buy_price ?? buyResult.buyPrice;
        const sellPrice = poc.sell_price ?? 0;
        const realPnl = sellPrice - buyPrice;
        const won = realPnl > 0;
        const status = won ? "won" : "lost";

        tradeStore.updateTrade(tradeId, {
          exitSpot: currentSpot,
          pnl: realPnl,
          closedAt: Date.now(),
          status,
          heldToExpiry: poc.is_expired === 1,
        });

        tradeStore.recordTradeResult(won, realPnl);
        tradeStore.setActivePosition(null);

        onTradeResolved(won, poc.is_expired === 1);

        const sessionId = sessionStore.currentSession?.id ?? "demo";
        const tiltScore = useTiltStore.getState().score;
        if (won) {
          fireArenaEvent("POW", sessionId);
          if (tiltScore < 30) {
            setTimeout(() => fireArenaEvent("EXECUTION_PERFECT", sessionId), 500);
          }
        } else if (tiltScore > 60) {
          fireArenaEvent("TILT_DETECTED", sessionId);
        } else {
          fireArenaEvent("BIAS_DETECTED", sessionId);
        }

        onUserTradeResolved({
          id: tradeId,
          won,
          pnl: realPnl,
          exitSpot: currentSpot,
          heldToExpiry: poc.is_expired === 1,
          durationMs: Date.now() - now,
        });

        tradeRepo.save({
          ...tradeRecord,
          exitSpot: currentSpot,
          pnl: realPnl,
          closedAt: Date.now(),
          status,
          heldToExpiry: poc.is_expired === 1,
        }).catch(() => {});

        activeRealContractId = null;
      }
    }).catch(() => {});

    return { success: true };
  } catch (err: unknown) {
    activeRealContractId = null;
    const msg = err && typeof err === "object" && "message" in err
      ? (err as { message: string }).message
      : "Trade failed";
    return { success: false, error: msg };
  }
}

export async function placeSimulatedTrade(params: {
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  duration: number;
  durationUnit: string;
}): Promise<{ success: boolean; error?: string }> {
  const { isRealTradeMode } = useTradeStore.getState();
  if (isRealTradeMode && derivTradingWS.isAuthenticated) {
    return placeRealTrade(params);
  }

  if (activeSim) {
    return { success: false, error: "A simulated trade is already active." };
  }

  const tradeStore = useTradeStore.getState();
  const sessionStore = useSessionStore.getState();

  const tradeId = nanoid();
  const now = Date.now();
  const expiryMs = getExpiryMs(params.duration, params.durationUnit);
  const expiryTime = now + expiryMs;

  activeSim = {
    id: tradeId,
    asset: params.asset,
    assetDisplayName: params.assetDisplayName,
    direction: params.direction,
    stake: params.stake,
    entrySpot: 0,
    duration: params.duration,
    durationUnit: params.durationUnit,
    startTime: now,
    expiryTime,
    unsubscribeTicks: null,
    expiryTimeout: null,
    gotFirstTick: false,
    lastPnlSign: 0,
    lastHitTime: 0,
  };

  tradeStore.setActivePosition({
    contractId: 0,
    asset: params.assetDisplayName,
    direction: params.direction,
    stake: params.stake,
    payout: params.stake * 1.85,
    entrySpot: 0,
    currentSpot: 0,
    currentPnl: 0,
    startTime: now,
    expiryTime,
    status: "open",
  });

  const unsub = subscribeTicks(params.asset, (tick) => {
    if (!activeSim) return;

    const currentSpot = tick.quote;

    if (!activeSim.gotFirstTick) {
      activeSim.gotFirstTick = true;
      activeSim.entrySpot = currentSpot;

      tradeStore.updateActivePosition({
        entrySpot: currentSpot,
        currentSpot,
        currentPnl: 0,
      });

      // Update tilt on placement before reading the score for entry metadata
      onTradePlaced(params.asset, params.stake);
      const tiltScoreAtEntry = useTiltStore.getState().score;

      const tradeRecord: Trade = {
        id: tradeId,
        sessionId: sessionStore.currentSession?.id ?? "demo",
        asset: params.asset,
        assetDisplayName: params.assetDisplayName,
        direction: params.direction,
        stake: params.stake,
        entrySpot: currentSpot,
        duration: params.duration,
        durationUnit: params.durationUnit,
        timestamp: now,
        status: "active",
        tiltScoreAtEntry,
        wasRevengeFlag: tiltScoreAtEntry > 60,
        heldToExpiry: false,
      };
      tradeStore.addTrade(tradeRecord);
      tradeRepo.save(tradeRecord).catch(() => {});

      onUserTradePlaced({
        id: tradeId,
        asset: params.asset,
        assetDisplayName: params.assetDisplayName,
        direction: params.direction,
        stake: params.stake,
        duration: params.duration,
        durationUnit: params.durationUnit,
        tiltScore: tiltScoreAtEntry,
        entrySpot: currentSpot,
      });

      return;
    }

    const currentPnl = calculateLivePnl(
      params.direction,
      activeSim.entrySpot,
      currentSpot,
      params.stake
    );

    tradeStore.updateActivePosition({ currentSpot, currentPnl });

    // Live arena hits: when P&L swings direction, fire a punch
    const HIT_COOLDOWN_MS = 2000;
    const nowMs = Date.now();
    const pnlSign = currentPnl > 0 ? 1 : currentPnl < 0 ? -1 : 0;
    if (
      pnlSign !== 0 &&
      pnlSign !== activeSim.lastPnlSign &&
      nowMs - activeSim.lastHitTime > HIT_COOLDOWN_MS
    ) {
      activeSim.lastPnlSign = pnlSign;
      activeSim.lastHitTime = nowMs;
      const arena = useArenaStore.getState();
      if (pnlSign > 0) {
        arena.triggerFight("jab", "hit");
        arena.adjustAntiYouHealth(-3);
      } else {
        arena.triggerFight("hit", "jab");
        arena.adjustYourHealth(-3);
      }
    }
  });

  activeSim.unsubscribeTicks = unsub;

  activeSim.expiryTimeout = setTimeout(() => {
    resolveSimulatedTrade();
  }, expiryMs);

  return { success: true };
}

async function resolveSimulatedTrade(): Promise<void> {
  if (!activeSim) return;

  const sim = activeSim;
  const tradeStore = useTradeStore.getState();
  const position = tradeStore.activePosition;

  if (sim.expiryTimeout) clearTimeout(sim.expiryTimeout);
  if (sim.unsubscribeTicks) sim.unsubscribeTicks();

  const exitSpot = position?.currentSpot ?? sim.entrySpot;
  const hasReliableEntry = sim.entrySpot > 0;
  const won = hasReliableEntry
    ? sim.direction === "CALL"
      ? exitSpot > sim.entrySpot
      : exitSpot < sim.entrySpot
    : false;
  const status = hasReliableEntry ? (won ? "won" : "lost") : "sold";
  const pnl = hasReliableEntry ? (won ? sim.stake * 0.85 : -sim.stake) : 0;

  tradeStore.updateTrade(sim.id, {
    exitSpot,
    pnl,
    closedAt: Date.now(),
    status,
    heldToExpiry: true,
  });

  if (status === "won" || status === "lost") {
    tradeStore.recordTradeResult(won, pnl);
  }
  tradeStore.setActivePosition(null);

  // Update tilt based on trade outcome — held to expiry = disciplined
  if (status === "won" || status === "lost") {
    onTradeResolved(won, true);
  }

  const sessionId = useSessionStore.getState().currentSession?.id ?? "demo";

  // Preserve the wasRevengeFlag recorded at entry
  const originalTrade = useTradeStore.getState().tradeHistory.find((t) => t.id === sim.id);
  const wasRevengeFlag = originalTrade?.wasRevengeFlag ?? false;
  const tiltScoreAtEntry = originalTrade?.tiltScoreAtEntry ?? 0;

  tradeRepo
    .save({
      id: sim.id,
      sessionId,
      asset: sim.asset,
      assetDisplayName: sim.assetDisplayName,
      direction: sim.direction,
      stake: sim.stake,
      entrySpot: sim.entrySpot,
      exitSpot,
      pnl,
      duration: sim.duration,
      durationUnit: sim.durationUnit,
      timestamp: sim.startTime,
      closedAt: Date.now(),
      status,
      tiltScoreAtEntry,
      wasRevengeFlag,
      heldToExpiry: true,
    })
    .catch(() => {});

  // Notify Anti-You engine
  if (status === "won" || status === "lost") {
    onUserTradeResolved({
      id: sim.id,
      won,
      pnl,
      exitSpot,
      heldToExpiry: true,
      durationMs: Date.now() - sim.startTime,
    });
  }

  // Fire arena events based on trade result
  const tiltScore = useTiltStore.getState().score;
  if (status === "won") {
    fireArenaEvent("POW", sessionId);
    if (tiltScore < 30 && sim.duration >= 3) {
      setTimeout(() => fireArenaEvent("EXECUTION_PERFECT", sessionId), 500);
    }
  } else if (status === "lost") {
    if (tiltScore > 60) {
      fireArenaEvent("TILT_DETECTED", sessionId);
    } else {
      fireArenaEvent("BIAS_DETECTED", sessionId);
    }
  }

  activeSim = null;
}

export async function sellSimulatedTradeEarly(): Promise<void> {
  if (!activeSim) return;

  const sim = activeSim;
  const tradeStore = useTradeStore.getState();
  const position = tradeStore.activePosition;

  if (sim.expiryTimeout) clearTimeout(sim.expiryTimeout);
  if (sim.unsubscribeTicks) sim.unsubscribeTicks();

  const exitSpot = position?.currentSpot ?? sim.entrySpot;
  const hasReliableEntry = sim.entrySpot > 0;
  const currentPnl = hasReliableEntry ? (position?.currentPnl ?? 0) : 0;

  // Early sell: you get whatever the current mark-to-market P&L is, with a haircut
  const pnl = currentPnl > 0 ? currentPnl * 0.7 : currentPnl;

  const earlyWon = hasReliableEntry && pnl >= 0;
  const status = hasReliableEntry ? (earlyWon ? "won" : "lost") : "sold";

  tradeStore.updateTrade(sim.id, {
    exitSpot,
    pnl,
    closedAt: Date.now(),
    status,
    heldToExpiry: false,
  });

  if (status === "won" || status === "lost") {
    tradeStore.recordTradeResult(earlyWon, pnl);
  }
  tradeStore.setActivePosition(null);

  // Update tilt based on early exit — heldToExpiry = false
  if (status === "won" || status === "lost") {
    onTradeResolved(earlyWon, false);
  }

  const sessionId = useSessionStore.getState().currentSession?.id ?? "demo";

  // Preserve the wasRevengeFlag recorded at entry
  const originalTrade = useTradeStore.getState().tradeHistory.find((t) => t.id === sim.id);
  const wasRevengeFlag = originalTrade?.wasRevengeFlag ?? false;
  const tiltScoreAtEntry = originalTrade?.tiltScoreAtEntry ?? 0;

  tradeRepo
    .save({
      id: sim.id,
      sessionId,
      asset: sim.asset,
      assetDisplayName: sim.assetDisplayName,
      direction: sim.direction,
      stake: sim.stake,
      entrySpot: sim.entrySpot,
      exitSpot,
      pnl,
      duration: sim.duration,
      durationUnit: sim.durationUnit,
      timestamp: sim.startTime,
      closedAt: Date.now(),
      status,
      tiltScoreAtEntry,
      wasRevengeFlag,
      heldToExpiry: false,
    })
    .catch(() => {});

  // Notify Anti-You engine
  if (status === "won" || status === "lost") {
    onUserTradeResolved({
      id: sim.id,
      won: pnl >= 0,
      pnl,
      exitSpot,
      heldToExpiry: false,
      durationMs: Date.now() - sim.startTime,
    });
  }

  // Fire arena events for early sell
  const tiltScoreNow = useTiltStore.getState().score;
  if (status === "won") {
    fireArenaEvent("POW", sessionId);
  } else if (status === "lost" && tiltScoreNow > 60) {
    fireArenaEvent("TILT_DETECTED", sessionId);
  } else if (status === "lost") {
    fireArenaEvent("BIAS_DETECTED", sessionId);
  }

  // Capture a phantom for "what if you held to expiry?"
  const elapsedMs = Date.now() - sim.startTime;
  const totalDurationMs = sim.durationUnit === "m"
    ? sim.duration * 60_000
    : sim.durationUnit === "h"
    ? sim.duration * 3_600_000
    : sim.duration * 1000;
  const remainingMs = Math.max(0, totalDurationMs - elapsedMs);
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60_000));

  evaluateAndCapture({
    signals: {
      assetViewedMs: elapsedMs,
      stakeEntered: true,
      directionSelected: true,
      buttonHoverMs: 0,
      buttonProximityPx: 0,
      timeOnFormMs: elapsedMs,
      cancelled: true,
    },
    asset: sim.asset,
    assetDisplayName: sim.assetDisplayName,
    direction: sim.direction,
    stake: sim.stake,
    duration: remainingMinutes,
    durationUnit: "m",
    type: "early_exit",
  });

  activeSim = null;
}

export function hasActiveSimulation(): boolean {
  return activeSim !== null || activeRealContractId !== null;
}
