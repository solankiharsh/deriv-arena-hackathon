"use client";

import { nanoid } from "nanoid";
import { subscribeTicks } from "@/lib/deriv/tick-bus";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { useSessionStore } from "@/lib/stores/session-store";
import { phantomRepo } from "@/lib/db/repositories";
import { calculateConfidence, type CaptureSignal } from "./phantom-capture";
import type { Phantom, TradeDirection, PhantomType } from "@/lib/db/schema";

interface TrackedPhantom {
  id: string;
  asset: string;
  direction: TradeDirection;
  stake: number;
  entrySpot: number;
  unsubscribeTicks: (() => void) | null;
  expiryTimeout: ReturnType<typeof setTimeout> | null;
  gotFirstTick: boolean;
}

const activeTrackers = new Map<string, TrackedPhantom>();

/**
 * Evaluate behavioral signals and capture a phantom if confidence is high enough.
 * Returns the phantom ID if captured, null otherwise.
 */
export function evaluateAndCapture(params: {
  signals: CaptureSignal;
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  duration: number;
  durationUnit: string;
  type: PhantomType;
}): string | null {
  const result = calculateConfidence(params.signals);

  if (result.tier === "GLANCED") return null;

  const phantomId = nanoid();
  const now = Date.now();

  const phantom: Phantom = {
    id: phantomId,
    sessionId: useSessionStore.getState().currentSession?.id ?? "demo",
    type: params.type,
    asset: params.asset,
    assetDisplayName: params.assetDisplayName,
    direction: params.direction,
    stake: params.stake,
    entrySpot: 0,
    capturedAt: now,
    confidenceScore: result.score,
    confidenceTier: result.tier,
    captureContext: result.description,
    status: "active",
  };

  usePhantomStore.getState().addPhantom(phantom);
  phantomRepo.save(phantom).catch(() => {});

  startPhantomTracking({
    id: phantomId,
    asset: params.asset,
    direction: params.direction,
    stake: params.stake,
    duration: params.duration,
    durationUnit: params.durationUnit,
  });

  return phantomId;
}

function getExpiryMs(duration: number, unit: string): number {
  switch (unit) {
    case "s": return duration * 1000;
    case "m": return duration * 60_000;
    case "h": return duration * 3_600_000;
    default:  return duration * 60_000;
  }
}

function calculatePhantomPnl(
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
  const sensitivity = entrySpot * 0.001;
  const ratio = Math.max(-1, Math.min(1, movement / sensitivity));
  return ratio >= 0 ? payout * ratio : stake * ratio;
}

function startPhantomTracking(params: {
  id: string;
  asset: string;
  direction: TradeDirection;
  stake: number;
  duration: number;
  durationUnit: string;
}): void {
  const tracker: TrackedPhantom = {
    id: params.id,
    asset: params.asset,
    direction: params.direction,
    stake: params.stake,
    entrySpot: 0,
    unsubscribeTicks: null,
    expiryTimeout: null,
    gotFirstTick: false,
  };

  activeTrackers.set(params.id, tracker);

  const unsub = subscribeTicks(params.asset, (tick) => {
    const t = activeTrackers.get(params.id);
    if (!t) return;

    const quote = tick.quote;

    if (!t.gotFirstTick) {
      t.gotFirstTick = true;
      t.entrySpot = quote;

      usePhantomStore.getState().updatePhantom(params.id, {
        entrySpot: quote,
        currentSpot: quote,
        currentPnl: 0,
      });

      phantomRepo.update(params.id, { entrySpot: quote }).catch(() => {});
      return;
    }

    const pnl = calculatePhantomPnl(params.direction, t.entrySpot, quote, params.stake);

    usePhantomStore.getState().updatePhantom(params.id, {
      currentSpot: quote,
      currentPnl: Math.round(pnl * 100) / 100,
    });
  });

  tracker.unsubscribeTicks = unsub;

  const expiryMs = getExpiryMs(params.duration, params.durationUnit);
  tracker.expiryTimeout = setTimeout(() => {
    const t = activeTrackers.get(params.id);
    if (!t) return;

    const phantomStore = usePhantomStore.getState();
    const phantom = phantomStore.activePhantoms.find((p) => p.id === params.id);
    const currentPnl = phantom?.currentPnl ?? 0;

    resolvePhantomTrade(
      params.id,
      currentPnl,
      currentPnl >= 0 ? "won" : "lost"
    );
  }, expiryMs);
}

export async function resolvePhantomTrade(
  phantomId: string,
  finalPnl: number,
  status: "won" | "lost" | "expired"
): Promise<void> {
  const tracker = activeTrackers.get(phantomId);

  if (tracker) {
    if (tracker.expiryTimeout) clearTimeout(tracker.expiryTimeout);
    if (tracker.unsubscribeTicks) tracker.unsubscribeTicks();
    activeTrackers.delete(phantomId);
  }

  usePhantomStore.getState().resolvePhantom(phantomId, Math.round(finalPnl * 100) / 100, status);

  phantomRepo.update(phantomId, {
    finalPnl: Math.round(finalPnl * 100) / 100,
    status,
    resolvedAt: Date.now(),
  }).catch(() => {});
}

export function getActivePhantomCount(): number {
  return activeTrackers.size;
}
