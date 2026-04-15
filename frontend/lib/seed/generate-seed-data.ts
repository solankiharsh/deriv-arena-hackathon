"use strict";

import type {
  Trade,
  Phantom,
  TiltEvent,
  Session,
  JournalEntry,
  ArenaEvent,
  WarRoomDebate,
  WeeklyBES,
  AchievementProgress,
  TradeDirection,
  TradeStatus,
  PhantomStatus,
  PhantomType,
  ConfidenceTier,
  TiltZone,
  ArenaEventType,
} from "../db/schema";

// Deterministic PRNG (mulberry32) so the seed data is reproducible
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ASSETS = [
  { symbol: "R_100", name: "Volatility 100 Index", market: "synthetic_index" },
  { symbol: "R_75", name: "Volatility 75 Index", market: "synthetic_index" },
  { symbol: "R_50", name: "Volatility 50 Index", market: "synthetic_index" },
  { symbol: "R_25", name: "Volatility 25 Index", market: "synthetic_index" },
  { symbol: "R_10", name: "Volatility 10 Index", market: "synthetic_index" },
  { symbol: "1HZ100V", name: "Volatility 100 (1s) Index", market: "synthetic_index" },
  { symbol: "BOOM1000", name: "Boom 1000 Index", market: "synthetic_index" },
  { symbol: "CRASH1000", name: "Crash 1000 Index", market: "synthetic_index" },
  { symbol: "stpRNG", name: "Step Index", market: "synthetic_index" },
  { symbol: "JD75", name: "Jump 75 Index", market: "synthetic_index" },
];

const BASE_PRICES: Record<string, number> = {
  R_100: 6823.45,
  R_75: 9872.12,
  R_50: 4521.33,
  R_25: 3241.22,
  R_10: 8412.88,
  "1HZ100V": 5213.67,
  BOOM1000: 9872.44,
  CRASH1000: 9654.21,
  stpRNG: 5124.50,
  JD75: 7832.11,
};

const TILT_ZONES: TiltZone[] = ["COMPOSED", "WARMING", "TILTING", "ON_TILT", "MELTDOWN"];
const CONFIDENCE_TIERS: ConfidenceTier[] = ["GLANCED", "WEIGHED", "HOVERED", "BAILED"];
const PHANTOM_TYPES: PhantomType[] = ["abandoned", "continuation", "anti-you"];
const ARENA_EVENT_TYPES: ArenaEventType[] = [
  "POW", "EXECUTION_PERFECT", "BIAS_DETECTED", "TILT_DETECTED",
  "REVENGE_BLOCKED", "PHANTOM_HIT", "KNOCKOUT", "COMBO",
];

const NARRATIVES = [
  "You opened the session with sharp discipline — the first four trades were textbook. But after a $28 drawdown on trade five, something shifted. Three consecutive CALL positions on R_100 in under four minutes screamed revenge trading. The phantom data confirms it: two Bailed-tier positions you abandoned during this spiral would have yielded +$41.20 combined.",
  "A masterclass in patience today. You passed on seven setups before committing to a high-conviction CALL on Volatility 75. That single trade returned +$72.50. Your phantom portfolio shows three Hovered-tier hesitations that all would have lost — your filter is getting sharper.",
  "The morning session was textbook: composed entries, disciplined exits. But the afternoon told a different story. After hitting your daily target of +$85, you kept trading. The next six trades erased 60% of your gains. Your Anti-You, ironically, would have stopped at +$85.",
  "Session characterized by overcaution. You canceled seven high-confidence setups and only executed three trades. The psychology tax today was steep: $124.30 in phantom profits left on the table. Your Bailed-tier phantoms had a 71% win rate — your gut knows more than your fear.",
  "Clean session with a clear edge. Five of seven trades followed the War Room consensus, and four of those five won. The one time you deviated (a contrarian PUT on Boom 1000), it cost you $35. The pattern is clear: your independent calls underperform your systematic ones by 23%.",
  "Tilt cascade detected at 11:47. A $52 loss on Crash 1000 triggered four rapid-fire trades in eight minutes, each with progressively larger stakes ($10 → $15 → $25 → $40). The lockout intervention at tilt score 73 saved you an estimated $80-120 based on the market movement that followed.",
  "Your strongest anti-correlation session yet: the Anti-You's mirrored positions returned -$67.20 while you gained +$43.80. The delta of $111 is your widest edge in three weeks. You're developing genuine behavioral alpha — particularly on synthetic indices where your pattern recognition outperforms random entry.",
  "Mixed signals today. Your win rate hit 67%, but average winner size ($12.30) lagged average loser size ($28.70). Three of your losses came from holding to expiry on positions that were profitable at the halfway point. Exit intelligence needs work: the optimal close points were consistently 40-60 seconds before expiry.",
];

const QUOTES = [
  "The market doesn't care about your last trade. Neither should you.",
  "Your highest-confidence hesitations are your best trades.",
  "Discipline isn't avoiding losses — it's avoiding stupid ones.",
  "The Anti-You wins when you trade from fear. Trade from analysis.",
  "Every revenge trade is a tax on your future self.",
  "Your phantom portfolio proves you know more than you trust.",
  "The tilt meter doesn't lie. Your P&L afterwards proves it.",
  "Consistency beats conviction. Your best weeks prove this.",
];

const JOURNAL_TAGS = [
  "tilt-recovery", "revenge-trading", "discipline-win", "phantom-insight",
  "anti-you-lesson", "overtrading", "patience-reward", "exit-timing",
  "risk-management", "streak-management", "emotional-awareness",
  "pattern-recognition", "session-review", "psychology-tax",
];

function id(rng: () => number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 21; i++) {
    result += chars[Math.floor(rng() * chars.length)];
  }
  return result;
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function range(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

function intRange(min: number, max: number, rng: () => number): number {
  return Math.floor(range(min, max + 1, rng));
}

function scoreToZone(score: number): TiltZone {
  if (score <= 20) return "COMPOSED";
  if (score <= 40) return "WARMING";
  if (score <= 60) return "TILTING";
  if (score <= 80) return "ON_TILT";
  return "MELTDOWN";
}

export interface SeedData {
  sessions: Session[];
  trades: Trade[];
  phantoms: Phantom[];
  tiltEvents: TiltEvent[];
  journalEntries: JournalEntry[];
  arenaEvents: ArenaEvent[];
  warRoomDebates: WarRoomDebate[];
  weeklyBES: WeeklyBES[];
  achievementProgress: AchievementProgress[];
}

export function generateSeedData(): SeedData {
  const rng = mulberry32(42);

  const now = Date.now();
  const TWO_MONTHS_MS = 60 * 24 * 60 * 60 * 1000;
  const startDate = now - TWO_MONTHS_MS;

  const sessions: Session[] = [];
  const trades: Trade[] = [];
  const phantoms: Phantom[] = [];
  const tiltEvents: TiltEvent[] = [];
  const journalEntries: JournalEntry[] = [];
  const arenaEvents: ArenaEvent[] = [];
  const warRoomDebates: WarRoomDebate[] = [];
  const weeklyBES: WeeklyBES[] = [];

  // Generate ~40 trading sessions over 2 months (weekdays mostly)
  let sessionDate = startDate;
  const tradingDays: number[] = [];

  while (sessionDate < now - 12 * 60 * 60 * 1000) {
    const day = new Date(sessionDate).getDay();
    if (day !== 0 && day !== 6) {
      if (rng() < 0.82) {
        tradingDays.push(sessionDate);
      }
    }
    sessionDate += 24 * 60 * 60 * 1000;
  }

  // Evolving trader performance: starts inconsistent, improves over time
  const totalDays = tradingDays.length;

  for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
    const dayStart = tradingDays[dayIdx];
    const progression = dayIdx / totalDays; // 0 → 1 over 2 months
    const baseWinRate = 0.42 + progression * 0.18; // 42% → 60%
    const baseTiltProbability = 0.35 - progression * 0.15; // 35% → 20%

    const sessionId = id(rng);
    const dateStr = new Date(dayStart).toISOString().split("T")[0];

    // Session starts between 9am-11am, lasts 1-4 hours
    const sessionStartOffset = range(9 * 3600000, 11 * 3600000, rng);
    const sessionStart = dayStart + sessionStartOffset;
    const sessionDuration = range(1 * 3600000, 4 * 3600000, rng);
    const sessionEnd = sessionStart + sessionDuration;

    const sessionTradeIds: string[] = [];
    const sessionPhantomIds: string[] = [];
    let sessionPnl = 0;
    let sessionPhantomPnl = 0;
    let tiltPeak = 0;
    let currentTilt = intRange(0, 15, rng);

    // 4-12 trades per session, more as trader gets experienced
    const tradeCount = intRange(4, Math.min(12, 5 + Math.floor(progression * 7)), rng);
    const tradeInterval = sessionDuration / (tradeCount + 1);

    let consecutiveLosses = 0;

    for (let t = 0; t < tradeCount; t++) {
      const tradeTime = sessionStart + tradeInterval * (t + 1) + range(-60000, 60000, rng);
      const asset = pick(ASSETS, rng);
      const direction: TradeDirection = rng() > 0.5 ? "CALL" : "PUT";
      const stake = pick([5, 10, 10, 15, 20, 25, 25, 50], rng);
      const duration = pick([1, 2, 3, 5, 5, 5, 10, 15], rng);
      const durationUnit = duration <= 3 ? "m" : pick(["m", "m", "h"], rng);

      const basePrice = BASE_PRICES[asset.symbol] ?? 5000;
      const entrySpot = basePrice * (1 + range(-0.02, 0.02, rng));

      // Revenge trading increases after consecutive losses
      const isRevenge = consecutiveLosses >= 2 && rng() < 0.6;
      const tiltAtEntry = currentTilt + (isRevenge ? intRange(5, 15, rng) : 0);

      // Win probability affected by tilt and progression
      const tiltPenalty = Math.max(0, (tiltAtEntry - 30) * 0.005);
      const winProb = Math.min(0.75, baseWinRate - tiltPenalty + (isRevenge ? -0.15 : 0));
      const won = rng() < winProb;

      const payout = stake * range(0.75, 0.92, rng);
      const pnl = won ? payout : -stake;
      const exitSpotMultiplier = won
        ? (direction === "CALL" ? 1 + range(0.0001, 0.003, rng) : 1 - range(0.0001, 0.003, rng))
        : (direction === "CALL" ? 1 - range(0.0001, 0.003, rng) : 1 + range(0.0001, 0.003, rng));
      const exitSpot = entrySpot * exitSpotMultiplier;

      const heldToExpiry = rng() > 0.2;
      const soldEarly = !won && !heldToExpiry && rng() > 0.5;
      const status: TradeStatus = soldEarly ? "sold" : (won ? "won" : "lost");
      const finalPnl = soldEarly ? -stake * range(0.3, 0.7, rng) : pnl;

      const tradeId = id(rng);

      trades.push({
        id: tradeId,
        sessionId,
        asset: asset.symbol,
        assetDisplayName: asset.name,
        direction,
        stake,
        entrySpot: Math.round(entrySpot * 100) / 100,
        exitSpot: Math.round(exitSpot * 100) / 100,
        pnl: Math.round(finalPnl * 100) / 100,
        duration,
        durationUnit,
        timestamp: tradeTime,
        closedAt: tradeTime + duration * 60000,
        status,
        tiltScoreAtEntry: Math.min(100, tiltAtEntry),
        wasRevengeFlag: isRevenge,
        heldToExpiry,
      });

      sessionTradeIds.push(tradeId);
      sessionPnl += finalPnl;

      // Update tilt
      if (!won) {
        consecutiveLosses++;
        currentTilt = Math.min(100, currentTilt + intRange(5, 15, rng));
      } else {
        consecutiveLosses = 0;
        currentTilt = Math.max(0, currentTilt - intRange(3, 10, rng));
      }
      tiltPeak = Math.max(tiltPeak, currentTilt);

      // Generate tilt events on zone transitions
      if (t > 0) {
        const prevScore = Math.max(0, currentTilt - (won ? intRange(3, 10, rng) : -intRange(5, 15, rng)));
        const prevZone = scoreToZone(prevScore);
        const currZone = scoreToZone(currentTilt);
        if (prevZone !== currZone) {
          tiltEvents.push({
            id: id(rng),
            sessionId,
            timestamp: tradeTime + 1000,
            fromZone: prevZone,
            toZone: currZone,
            tiltScore: currentTilt,
            triggerSignals: [
              won ? "win-recovery" : "consecutive-loss",
              isRevenge ? "revenge-flag" : "normal-entry",
            ].filter(Boolean),
            interventionShown: currentTilt > 60,
            interventionAccepted: currentTilt > 60 && rng() > 0.4,
          });
        }
      }
    }

    // Generate 1-4 phantoms per session
    const phantomCount = intRange(1, 4, rng);
    for (let p = 0; p < phantomCount; p++) {
      const phantomTime = sessionStart + range(0.1, 0.9, rng) * sessionDuration;
      const asset = pick(ASSETS, rng);
      const direction: TradeDirection = rng() > 0.5 ? "CALL" : "PUT";
      const tier = pick(CONFIDENCE_TIERS, rng);
      const type = pick(PHANTOM_TYPES, rng);
      const stake = pick([10, 15, 20, 25], rng);
      const basePrice = BASE_PRICES[asset.symbol] ?? 5000;
      const entrySpot = basePrice * (1 + range(-0.02, 0.02, rng));

      const isResolved = rng() > 0.15;
      const phantomWon = rng() < (baseWinRate + 0.05);
      const phantomPnl = phantomWon
        ? stake * range(0.7, 0.9, rng)
        : -stake * range(0.8, 1.0, rng);
      const status: PhantomStatus = isResolved
        ? (phantomWon ? "won" : "lost")
        : "active";

      const phantomId = id(rng);

      phantoms.push({
        id: phantomId,
        sessionId,
        type,
        asset: asset.symbol,
        assetDisplayName: asset.name,
        direction,
        stake,
        entrySpot: Math.round(entrySpot * 100) / 100,
        currentSpot: isResolved ? undefined : Math.round(entrySpot * (1 + range(-0.002, 0.002, rng)) * 100) / 100,
        currentPnl: isResolved ? undefined : Math.round(range(-15, 20, rng) * 100) / 100,
        finalPnl: isResolved ? Math.round(phantomPnl * 100) / 100 : undefined,
        capturedAt: phantomTime,
        resolvedAt: isResolved ? phantomTime + range(60000, 600000, rng) : undefined,
        confidenceScore: tier === "GLANCED" ? intRange(5, 25, rng)
          : tier === "WEIGHED" ? intRange(26, 50, rng)
          : tier === "HOVERED" ? intRange(51, 75, rng)
          : intRange(76, 100, rng),
        confidenceTier: tier,
        captureContext: tier === "BAILED" ? "Was going to trade, bailed at the last second"
          : tier === "HOVERED" ? "Finger was on the trigger — pulled back"
          : tier === "WEIGHED" ? "Seriously weighed the options"
          : "Barely glanced at the trade",
        status,
      });

      sessionPhantomIds.push(phantomId);
      if (isResolved) sessionPhantomPnl += phantomPnl;
    }

    // Arena events (2-5 per session)
    const arenaEventCount = intRange(2, 5, rng);
    for (let a = 0; a < arenaEventCount; a++) {
      const eventTime = sessionStart + range(0.05, 0.95, rng) * sessionDuration;
      const eventType = pick(ARENA_EVENT_TYPES, rng);
      const descriptions: Record<ArenaEventType, string[]> = {
        POW: ["Clean execution on high-confidence setup", "Textbook entry and exit"],
        EXECUTION_PERFECT: ["Zero slippage, perfect timing", "Optimal position sizing"],
        BIAS_DETECTED: ["Confirmation bias on bullish streak", "Recency bias after loss"],
        TILT_DETECTED: ["Rapid-fire entries detected", "Stake escalation pattern"],
        REVENGE_BLOCKED: ["Intervention prevented revenge trade", "Cooldown timer activated"],
        PHANTOM_HIT: ["Bailed phantom would have won +$32", "Abandoned position hit target"],
        KNOCKOUT: ["Anti-You neutralized by discipline", "Shadow trader defeated this round"],
        COMBO: ["3-trade win streak bonus", "Discipline combo maintained"],
        KNOCKOUT_FINISHER: ["20% profit target reached — devastating finishing blow", "KO Finisher triggered"],
        HEAT_MODE_ACTIVATED: ["Win streak on fire — enhanced trading power", "Heat mode engaged"],
        CHAOS_EVENT: ["Breaking news disrupts the market", "Chaos event triggered"],
        HALLUCINATION_TRIGGERED: ["Discipline slipping — reality distortion active", "Hallucination warning"],
        MOLE_EXPOSED: ["The insider has been identified", "Mole eliminated from war council"],
      };

      arenaEvents.push({
        id: id(rng),
        sessionId,
        timestamp: eventTime,
        type: eventType,
        description: pick(descriptions[eventType], rng),
        impact: intRange(5, 25, rng) * (["BIAS_DETECTED", "TILT_DETECTED"].includes(eventType) ? -1 : 1),
        side: ["BIAS_DETECTED", "TILT_DETECTED", "PHANTOM_HIT"].includes(eventType)
          ? "anti-you"
          : ["POW", "EXECUTION_PERFECT", "KNOCKOUT", "COMBO"].includes(eventType)
          ? "you"
          : "center",
      });
    }

    // War Room debate (0-2 per session)
    if (rng() < 0.6) {
      const debateAsset = pick(ASSETS, rng);
      const bullDir: TradeDirection = rng() > 0.4 ? "CALL" : "PUT";
      const bearDir: TradeDirection = bullDir === "CALL" ? "PUT" : "CALL";
      const owlDir: TradeDirection = rng() > 0.5 ? bullDir : bearDir;
      const consensusDir = owlDir;
      const consensusConf = intRange(55, 92, rng);
      const followed = rng() > 0.35;
      const outcome: "win" | "loss" = rng() < (baseWinRate + 0.1) ? "win" : "loss";

      warRoomDebates.push({
        id: id(rng),
        sessionId,
        timestamp: sessionStart + range(0.1, 0.4, rng) * sessionDuration,
        asset: debateAsset.symbol,
        bullDirection: bullDir,
        bullConfidence: intRange(55, 95, rng),
        bullReasoning: `Momentum indicators show ${bullDir === "CALL" ? "upward" : "downward"} pressure on ${debateAsset.name}. RSI divergence supports ${bullDir} entry.`,
        bearDirection: bearDir,
        bearConfidence: intRange(45, 85, rng),
        bearReasoning: `Overbought conditions suggest reversal. Volume declining — classic ${bearDir === "PUT" ? "distribution" : "accumulation"} pattern.`,
        owlDirection: owlDir,
        owlConfidence: intRange(50, 80, rng),
        owlReasoning: `Balancing both perspectives: the risk/reward favors ${owlDir} but with reduced stake. Set tight stops.`,
        consensusDirection: consensusDir,
        consensusConfidence: consensusConf,
        userFollowedConsensus: followed,
        outcome,
      });
    }

    // Journal entry
    journalEntries.push({
      id: id(rng),
      sessionId,
      timestamp: sessionEnd - 60000,
      narrative: pick(NARRATIVES, rng),
      tags: Array.from(
        { length: intRange(2, 4, rng) },
        () => pick(JOURNAL_TAGS, rng)
      ).filter((v, i, a) => a.indexOf(v) === i),
      aiQuote: pick(QUOTES, rng),
      premortemResponses: [],
    });

    // Arena result for session
    const yourArenaScore = 50 + sessionPnl * 0.3 + (tiltPeak < 40 ? 10 : -10);
    const arenaResult: "win" | "loss" | "draw" =
      yourArenaScore > 55 ? "win" : yourArenaScore < 45 ? "loss" : "draw";

    sessions.push({
      id: sessionId,
      date: dateStr,
      startTime: sessionStart,
      endTime: sessionEnd,
      tradeIds: sessionTradeIds,
      phantomIds: sessionPhantomIds,
      tiltPeak: Math.min(100, tiltPeak),
      besScore: Math.round(55 + progression * 25 + range(-8, 8, rng)),
      actualPnl: Math.round(sessionPnl * 100) / 100,
      phantomPnl: Math.round(sessionPhantomPnl * 100) / 100,
      antiYouPnl: Math.round((sessionPnl * range(-0.8, 0.6, rng)) * 100) / 100,
      arenaResult,
      narrativeGenerated: true,
    });
  }

  // Weekly BES scores (8 weeks)
  for (let w = 0; w < 8; w++) {
    const weekStart = startDate + w * 7 * 24 * 3600000;
    const weekEnd = weekStart + 7 * 24 * 3600000;
    const weekProgression = w / 8;

    const phantomEff = Math.round(45 + weekProgression * 30 + range(-10, 10, rng));
    const exitIntel = Math.round(50 + weekProgression * 25 + range(-8, 8, rng));
    const tiltRes = Math.round(55 + weekProgression * 28 + range(-12, 12, rng));
    const antiYouDelta = Math.round(range(-30, 60, rng) + weekProgression * 20);

    const weekTrades = trades.filter((t) => t.timestamp >= weekStart && t.timestamp < weekEnd);
    const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const weekPhantoms = phantoms.filter(
      (p) => p.capturedAt >= weekStart && p.capturedAt < weekEnd && p.finalPnl !== undefined
    );
    const weekPhantomPnl = weekPhantoms.reduce((s, p) => s + (p.finalPnl ?? 0), 0);

    weeklyBES.push({
      id: id(rng),
      weekStart,
      weekEnd,
      besScore: Math.min(100, Math.max(0, Math.round(
        phantomEff * 0.25 + exitIntel * 0.25 + tiltRes * 0.25 + Math.max(0, antiYouDelta) * 0.25 / 100 * 100
      ))),
      phantomEfficiency: Math.min(100, Math.max(0, phantomEff)),
      exitIntelligence: Math.min(100, Math.max(0, exitIntel)),
      tiltResistance: Math.min(100, Math.max(0, tiltRes)),
      antiYouDifferential: antiYouDelta,
      actualPnl: Math.round(weekPnl * 100) / 100,
      phantomPnl: Math.round(weekPhantomPnl * 100) / 100,
      disciplineBonus: Math.round(range(0, 15, rng) * 100) / 100,
      netPsychologyTax: Math.round(range(-50, -5, rng) * 100) / 100,
    });
  }

  // Achievement progress
  const achievementProgress: AchievementProgress[] = [
    { id: "phantom-hunter", badgeId: "phantom-hunter", progress: 87, target1: 10, target2: 50, target3: 100, unlockedTier: 2 },
    { id: "tilt-master", badgeId: "tilt-master", progress: 14, target1: 5, target2: 15, target3: 30, unlockedTier: 1 },
    { id: "discipline-warrior", badgeId: "discipline-warrior", progress: 22, target1: 10, target2: 25, target3: 50, unlockedTier: 1 },
    { id: "shadow-slayer", badgeId: "shadow-slayer", progress: 6, target1: 5, target2: 20, target3: 50, unlockedTier: 1 },
    { id: "streak-keeper", badgeId: "streak-keeper", progress: 5, target1: 3, target2: 7, target3: 15, unlockedTier: 2 },
    { id: "journal-scholar", badgeId: "journal-scholar", progress: sessions.length, target1: 10, target2: 30, target3: 100, unlockedTier: sessions.length >= 30 ? 2 : 1 },
    { id: "war-room-veteran", badgeId: "war-room-veteran", progress: warRoomDebates.length, target1: 5, target2: 25, target3: 100, unlockedTier: warRoomDebates.length >= 25 ? 2 : 1 },
    { id: "bes-elite", badgeId: "bes-elite", progress: 3, target1: 1, target2: 5, target3: 20, unlockedTier: 1 },
  ];

  return {
    sessions,
    trades,
    phantoms,
    tiltEvents,
    journalEntries,
    arenaEvents,
    warRoomDebates,
    weeklyBES,
    achievementProgress,
  };
}
