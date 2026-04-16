"use client";

import Dexie, { type EntityTable } from "dexie";

// ── Domain Types ────────────────────────────────────────────────────────────

export type PhantomType = "abandoned" | "continuation" | "anti-you" | "early_exit";
export type ConfidenceTier = "GLANCED" | "WEIGHED" | "HOVERED" | "BAILED";
export type TiltZone = "COMPOSED" | "WARMING" | "TILTING" | "ON_TILT" | "MELTDOWN";
export type TradeDirection = "CALL" | "PUT";
export type TradeStatus = "active" | "won" | "lost" | "sold";
export type PhantomStatus = "active" | "won" | "lost" | "expired";
export type ArenaEventType =
  | "POW"
  | "EXECUTION_PERFECT"
  | "BIAS_DETECTED"
  | "TILT_DETECTED"
  | "REVENGE_BLOCKED"
  | "PHANTOM_HIT"
  | "KNOCKOUT"
  | "COMBO"
  | "KNOCKOUT_FINISHER"
  | "HEAT_MODE_ACTIVATED"
  | "CHAOS_EVENT"
  | "HALLUCINATION_TRIGGERED"
  | "MOLE_EXPOSED";

export type AntiYouEvolutionType = "SIMPLE_MIRROR" | "PATTERN_MIRROR" | "BEHAVIORAL_MIRROR" | "FULL_INVERSE";

export interface ShadowTrade {
  id: string;
  userTradeId: string;
  sessionId: string;
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  entrySpot: number;
  exitSpot?: number;
  finalPnl?: number;
  startTime: number;
  expiryTime: number;
  closedAt?: number;
  status: "open" | "won" | "lost";
  strategy: AntiYouEvolutionType;
  reasoning: string;
}

export interface Trade {
  id: string;
  sessionId: string;
  contractId?: number;
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  entrySpot: number;
  exitSpot?: number;
  pnl?: number;
  duration: number;
  durationUnit: string;
  timestamp: number;
  closedAt?: number;
  status: TradeStatus;
  tiltScoreAtEntry: number;
  wasRevengeFlag: boolean;
  heldToExpiry: boolean;
  premortemText?: string;
  premortemAccepted?: boolean;
}

export interface Phantom {
  id: string;
  sessionId: string;
  type: PhantomType;
  relatedTradeId?: string;
  asset: string;
  assetDisplayName: string;
  direction: TradeDirection;
  stake: number;
  entrySpot: number;
  currentSpot?: number;
  currentPnl?: number;
  finalPnl?: number;
  capturedAt: number;
  resolvedAt?: number;
  estimatedExpiry?: number;
  confidenceScore: number;
  confidenceTier: ConfidenceTier;
  captureContext: string;
  status: PhantomStatus;
  subscriptionId?: string;
}

export interface TiltEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  fromZone: TiltZone;
  toZone: TiltZone;
  tiltScore: number;
  triggerSignals: string[];
  interventionShown: boolean;
  interventionAccepted: boolean;
  tradeAfterwards?: boolean;
  pnlAfterwards?: number;
}

export interface Session {
  id: string;
  date: string;
  startTime: number;
  endTime?: number;
  tradeIds: string[];
  phantomIds: string[];
  tiltPeak: number;
  besScore?: number;
  actualPnl?: number;
  phantomPnl?: number;
  antiYouPnl?: number;
  arenaResult?: "win" | "loss" | "draw";
  narrativeGenerated: boolean;
}

export interface JournalEntry {
  id: string;
  sessionId: string;
  timestamp: number;
  narrative: string;
  tags: string[];
  aiQuote?: string;
  premortemResponses: string[];
}

export interface Achievement {
  id: string;
  badgeId: string;
  tier: 1 | 2 | 3;
  unlockedAt: number;
  sessionId: string;
}

export interface AchievementProgress {
  id: string;
  badgeId: string;
  progress: number;
  target1: number;
  target2: number;
  target3: number;
  unlockedTier: 0 | 1 | 2 | 3;
}

export interface ArenaEvent {
  id: string;
  sessionId: string;
  timestamp: number;
  type: ArenaEventType;
  description: string;
  impact: number;
  side: "you" | "anti-you" | "center";
}

export interface WarRoomDebate {
  id: string;
  sessionId: string;
  timestamp: number;
  asset: string;
  bullDirection: TradeDirection;
  bullConfidence: number;
  bullReasoning: string;
  bearDirection: TradeDirection;
  bearConfidence: number;
  bearReasoning: string;
  owlDirection: TradeDirection;
  owlConfidence: number;
  owlReasoning: string;
  consensusDirection?: TradeDirection;
  consensusConfidence?: number;
  userFollowedConsensus?: boolean;
  outcome?: "win" | "loss";
}

export interface WeeklyBES {
  id: string;
  weekStart: number;
  weekEnd: number;
  besScore: number;
  phantomEfficiency: number;
  exitIntelligence: number;
  tiltResistance: number;
  antiYouDifferential: number;
  actualPnl: number;
  phantomPnl: number;
  disciplineBonus: number;
  netPsychologyTax: number;
}

// ── Dexie Database ────────────────────────────────────────────────────────────

class PhantomLedgerDB extends Dexie {
  trades!: EntityTable<Trade, "id">;
  phantoms!: EntityTable<Phantom, "id">;
  tiltEvents!: EntityTable<TiltEvent, "id">;
  sessions!: EntityTable<Session, "id">;
  journalEntries!: EntityTable<JournalEntry, "id">;
  achievements!: EntityTable<Achievement, "id">;
  achievementProgress!: EntityTable<AchievementProgress, "id">;
  arenaEvents!: EntityTable<ArenaEvent, "id">;
  warRoomDebates!: EntityTable<WarRoomDebate, "id">;
  weeklyBES!: EntityTable<WeeklyBES, "id">;
  shadowTrades!: EntityTable<ShadowTrade, "id">;

  constructor() {
    super("PhantomLedger");

    this.version(1).stores({
      trades: "id, sessionId, timestamp, status, asset, tiltScoreAtEntry, wasRevengeFlag",
      phantoms: "id, sessionId, type, status, asset, confidenceTier, capturedAt",
      tiltEvents: "id, sessionId, timestamp, toZone, tiltScore",
      sessions: "id, date, startTime, endTime",
      journalEntries: "id, sessionId, timestamp, *tags",
      achievements: "id, badgeId, tier, unlockedAt",
      achievementProgress: "id, badgeId",
      arenaEvents: "id, sessionId, timestamp, type",
      warRoomDebates: "id, sessionId, timestamp, asset",
      weeklyBES: "id, weekStart",
    });

    this.version(2).stores({
      trades: "id, sessionId, timestamp, status, asset, tiltScoreAtEntry, wasRevengeFlag",
      phantoms: "id, sessionId, type, status, asset, confidenceTier, capturedAt",
      tiltEvents: "id, sessionId, timestamp, toZone, tiltScore",
      sessions: "id, date, startTime, endTime",
      journalEntries: "id, sessionId, timestamp, *tags",
      achievements: "id, badgeId, tier, unlockedAt",
      achievementProgress: "id, badgeId",
      arenaEvents: "id, sessionId, timestamp, type",
      warRoomDebates: "id, sessionId, timestamp, asset",
      weeklyBES: "id, weekStart",
      shadowTrades: "id, sessionId, userTradeId, startTime, status, asset, strategy",
    });
  }
}

let dbInstance: PhantomLedgerDB | null = null;

export function getDB(): PhantomLedgerDB {
  if (!dbInstance) {
    dbInstance = new PhantomLedgerDB();
  }
  return dbInstance;
}
