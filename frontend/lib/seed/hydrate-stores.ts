"use client";

import { getDB } from "../db/schema";
import { generateSeedData } from "./generate-seed-data";
import { useTradeStore } from "../stores/trade-store";
import { usePhantomStore } from "../stores/phantom-store";
import { useTiltStore } from "../stores/tilt-store";
import { useAntiYouStore } from "../stores/anti-you-store";
import { useSessionStore } from "../stores/session-store";

/**
 * Seed IndexedDB with realistic 2-month data if the DB is empty,
 * then populate all Zustand stores from IndexedDB.
 * Safe to call multiple times — idempotent.
 */
export async function seedAndHydrate(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    await ensureSeedData();
    await hydrateZustandFromDB();
  } catch {
    // DB not available (SSR, private browsing, etc.)
  }
}

async function ensureSeedData(): Promise<void> {
  const db = getDB();
  const count = await db.trades.count();
  if (count > 0) return;

  const seed = generateSeedData();

  await db.transaction(
    "rw",
    [
      db.sessions,
      db.trades,
      db.phantoms,
      db.tiltEvents,
      db.journalEntries,
      db.arenaEvents,
      db.warRoomDebates,
      db.weeklyBES,
      db.achievementProgress,
    ],
    async () => {
      await db.sessions.bulkPut(seed.sessions);
      await db.trades.bulkPut(seed.trades);
      await db.phantoms.bulkPut(seed.phantoms);
      await db.tiltEvents.bulkPut(seed.tiltEvents);
      await db.journalEntries.bulkPut(seed.journalEntries);
      await db.arenaEvents.bulkPut(seed.arenaEvents);
      await db.warRoomDebates.bulkPut(seed.warRoomDebates);
      await db.weeklyBES.bulkPut(seed.weeklyBES);
      await db.achievementProgress.bulkPut(seed.achievementProgress);
    }
  );
}

async function hydrateZustandFromDB(): Promise<void> {
  const db = getDB();

  const sessions = await db.sessions.orderBy("startTime").reverse().limit(50).toArray();
  if (sessions.length === 0) return;

  const currentSession = sessions[0];
  const sessionTrades = await db.trades
    .where("sessionId")
    .equals(currentSession.id)
    .toArray();

  const recentTrades = await db.trades.orderBy("timestamp").reverse().limit(100).toArray();

  const activePhantoms = await db.phantoms.where("status").equals("active").toArray();
  const resolvedPhantoms = await db.phantoms
    .where("status")
    .anyOf(["won", "lost", "expired"])
    .reverse()
    .limit(200)
    .toArray();

  // ── Session store ──
  useSessionStore.getState().setCurrentSession(currentSession);
  useSessionStore.getState().setSessionHistory(sessions);

  // ── Trade store ──
  let pnl = 0;
  let tradeCount = 0;
  let wins = 0;
  let currentWinStreak = 0;
  let currentLossStreak = 0;

  const sorted = [...sessionTrades].sort((a, b) => a.timestamp - b.timestamp);
  for (const t of sorted) {
    if (t.status === "active") continue;
    const won = t.status === "won";
    pnl += t.pnl ?? 0;
    tradeCount++;
    if (won) {
      wins++;
      currentWinStreak++;
      currentLossStreak = 0;
    } else {
      currentWinStreak = 0;
      currentLossStreak++;
    }
  }

  useTradeStore.setState({
    sessionPnl: Math.round(pnl * 100) / 100,
    sessionTrades: tradeCount,
    sessionWins: wins,
    winStreak: currentWinStreak,
    lossStreak: currentLossStreak,
    tradeHistory: recentTrades,
  });

  // ── Phantom store ──
  usePhantomStore.getState().setActivePhantoms(activePhantoms);
  usePhantomStore.getState().setResolvedPhantoms(resolvedPhantoms);

  // ── Tilt store ──
  const sessionTiltEvents = await db.tiltEvents
    .where("sessionId")
    .equals(currentSession.id)
    .toArray();
  const sortedTiltEvents = [...sessionTiltEvents].sort((a, b) => a.timestamp - b.timestamp);

  const tiltStore = useTiltStore.getState();
  const currentTiltScore = sortedTiltEvents.length > 0
    ? sortedTiltEvents[sortedTiltEvents.length - 1].tiltScore
    : Math.min(100, currentSession.tiltPeak);
  const lastCompletedTrade = sorted[sorted.length - 1];
  let consecutiveLosses = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].status === "lost") {
      consecutiveLosses++;
    } else if (sorted[i].status === "won" || sorted[i].status === "sold") {
      break;
    }
  }
  const lastLossTrade = [...sorted].reverse().find((trade) => trade.status === "lost");

  useTiltStore.setState({
    history: [],
    consecutiveLosses,
    lastTradeTimestamp: lastCompletedTrade?.closedAt ?? lastCompletedTrade?.timestamp ?? null,
    lastLossTimestamp: lastLossTrade?.closedAt ?? lastLossTrade?.timestamp ?? null,
  });
  tiltStore.setScore(Math.min(100, Math.max(0, currentTiltScore)));
  for (const te of sortedTiltEvents) {
    tiltStore.addHistory({
      timestamp: te.timestamp,
      score: te.tiltScore,
      zone: te.toZone,
    });
  }

  // ── Anti-You store ──
  const antiYouPnl = currentSession.antiYouPnl ?? pnl * -0.3;

  const profileTrades = [...recentTrades]
    .filter((trade) => trade.status === "won" || trade.status === "lost")
    .sort((a, b) => a.timestamp - b.timestamp);
  const assetFrequency: Record<string, number> = {};
  const directionBias: Record<string, number> = {};
  const winRateByAsset: Record<string, { wins: number; total: number }> = {};
  const timeOfDayBuckets = new Array(24).fill(0) as number[];
  let holdDurationTotalMs = 0;
  let earlyExitCount = 0;
  let totalStake = 0;
  let afterLossStakeTotal = 0;
  let afterLossStakeCount = 0;
  let afterWinStakeTotal = 0;
  let afterWinStakeCount = 0;
  let reentryAfterLossTotalMs = 0;
  let reentryAfterLossCount = 0;
  let consecutiveLossesInProfile = 0;

  for (let index = 0; index < profileTrades.length; index++) {
    const trade = profileTrades[index];
    assetFrequency[trade.asset] = (assetFrequency[trade.asset] ?? 0) + 1;
    const biasKey = `${trade.asset}:${trade.direction}`;
    directionBias[biasKey] = (directionBias[biasKey] ?? 0) + 1;
    totalStake += trade.stake;
    const hour = new Date(trade.timestamp).getHours();
    timeOfDayBuckets[hour] += 1;
    const closedAt = trade.closedAt ?? trade.timestamp;
    holdDurationTotalMs += Math.max(0, closedAt - trade.timestamp);
    if (!trade.heldToExpiry) earlyExitCount += 1;

    if (!winRateByAsset[trade.asset]) {
      winRateByAsset[trade.asset] = { wins: 0, total: 0 };
    }
    winRateByAsset[trade.asset].total += 1;
    if (trade.status === "won") {
      winRateByAsset[trade.asset].wins += 1;
    }

    const previousTrade = profileTrades[index - 1];
    if (previousTrade?.status === "lost") {
      afterLossStakeTotal += trade.stake;
      afterLossStakeCount += 1;
      reentryAfterLossTotalMs += Math.max(0, trade.timestamp - (previousTrade.closedAt ?? previousTrade.timestamp));
      reentryAfterLossCount += 1;
    } else if (previousTrade?.status === "won") {
      afterWinStakeTotal += trade.stake;
      afterWinStakeCount += 1;
    }

    if (trade.status === "lost") {
      consecutiveLossesInProfile += 1;
    } else {
      consecutiveLossesInProfile = 0;
    }
  }

  const totalProfileTrades = profileTrades.length;
  const lastProfileTrade = profileTrades[profileTrades.length - 1];
  useAntiYouStore.getState().setProfile({
    totalTrades: totalProfileTrades,
    assetFrequency,
    directionBias,
    avgStake: totalProfileTrades > 0 ? totalStake / totalProfileTrades : 0,
    stakeAfterLoss: afterLossStakeCount > 0 ? afterLossStakeTotal / afterLossStakeCount : 0,
    stakeAfterWin: afterWinStakeCount > 0 ? afterWinStakeTotal / afterWinStakeCount : 0,
    avgHoldDurationMs: totalProfileTrades > 0 ? holdDurationTotalMs / totalProfileTrades : 0,
    earlyExitRate: totalProfileTrades > 0 ? earlyExitCount / totalProfileTrades : 0,
    timeOfDayBuckets,
    winRateByAsset,
    winRateByTiltZone: {},
    avgReentryAfterLossMs: reentryAfterLossCount > 0 ? reentryAfterLossTotalMs / reentryAfterLossCount : 0,
    lastTradeDirection: lastProfileTrade?.direction ?? null,
    lastTradeWon: lastProfileTrade?.status !== "lost",
    consecutiveLosses: consecutiveLossesInProfile,
    lastTradeTimestamp: lastProfileTrade?.timestamp ?? 0,
    detectedPatterns: [],
  });

  useAntiYouStore.setState({
    sessionCount: sessions.length,
    yourSessionPnl: Math.round(pnl * 100) / 100,
    antiYouSessionPnl: Math.round(antiYouPnl * 100) / 100,
  });

  // Equity curves
  const curveSessions = sessions.slice(0, 30).reverse();
  let yourCumulative = 0;
  let antiYouCumulative = 0;
  const yourCurve: Array<{ timestamp: number; value: number }> = [];
  const antiYouCurve: Array<{ timestamp: number; value: number }> = [];

  for (const s of curveSessions) {
    yourCumulative += s.actualPnl ?? 0;
    antiYouCumulative += s.antiYouPnl ?? 0;
    yourCurve.push({ timestamp: s.startTime, value: Math.round(yourCumulative * 100) / 100 });
    antiYouCurve.push({ timestamp: s.startTime, value: Math.round(antiYouCumulative * 100) / 100 });
  }

  useAntiYouStore.setState({
    yourEquityCurve: yourCurve,
    antiYouEquityCurve: antiYouCurve,
  });

  // Weekly results
  const weeklyResults = [];
  for (let w = 0; w < Math.min(8, Math.floor(sessions.length / 5)); w++) {
    const weekSessions = sessions.slice(w * 5, (w + 1) * 5);
    if (weekSessions.length === 0) break;
    const yPnl = weekSessions.reduce((s, ses) => s + (ses.actualPnl ?? 0), 0);
    const ayPnl = weekSessions.reduce((s, ses) => s + (ses.antiYouPnl ?? 0), 0);
    weeklyResults.push({
      weekStart: weekSessions[weekSessions.length - 1].startTime,
      weekEnd: weekSessions[0].endTime ?? weekSessions[0].startTime,
      yourPnl: Math.round(yPnl * 100) / 100,
      antiYouPnl: Math.round(ayPnl * 100) / 100,
      winner: (yPnl > ayPnl ? "you" : yPnl < ayPnl ? "anti-you" : "draw") as "you" | "anti-you" | "draw",
      delta: Math.round((yPnl - ayPnl) * 100) / 100,
    });
  }

  const antiYouStore = useAntiYouStore.getState();
  useAntiYouStore.setState({ weeklyResults: [] });
  for (const wr of weeklyResults) {
    antiYouStore.addWeeklyResult(wr);
  }

  antiYouStore.setPersonalities(
    {
      tradesPerDay: Math.round(tradeCount / Math.max(1, sessions.length) * 10) / 10,
      peakHours: "10:00 - 13:00",
      afterLossBehavior: "Tends to increase stake and trade faster",
      avgHoldDuration: 4.2,
      favoriteAssets: ["R_100", "R_75", "BOOM1000"],
      escalatesAfterLoss: true,
      exitsEarly: false,
    },
    {
      tradesPerDay: Math.round(tradeCount / Math.max(1, sessions.length) * 10) / 10 + 1.5,
      peakHours: "09:00 - 16:00",
      afterLossBehavior: "Immediately doubles down",
      avgHoldDuration: 2.8,
      favoriteAssets: ["R_50", "CRASH1000", "stpRNG"],
      escalatesAfterLoss: true,
      exitsEarly: true,
    }
  );

  antiYouStore.setAiInsight(
    "Your Anti-You mirrors your worst impulses amplified: it trades 40% more frequently, holds 33% shorter, and escalates stakes after every loss. Over 2 months, this behavioral gap has cost the shadow version $" +
    Math.abs(Math.round(antiYouCumulative)).toString() +
    " more than you. Your edge is patience."
  );

  antiYouStore.setEdgesAndBlindSpots(
    [
      { asset: "R_100", yourPnl: 142.30, antiYouPnl: -67.20 },
      { asset: "R_75", yourPnl: 89.10, antiYouPnl: 12.40 },
      { asset: "BOOM1000", yourPnl: 34.50, antiYouPnl: -28.90 },
    ],
    [
      { asset: "CRASH1000", yourPnl: -45.20, antiYouPnl: 32.10 },
      { asset: "stpRNG", yourPnl: -22.80, antiYouPnl: 15.60 },
    ]
  );
}
