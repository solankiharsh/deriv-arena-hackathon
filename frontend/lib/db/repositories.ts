"use client";

import { nanoid } from "nanoid";
import { getDB, type Trade, type Phantom, type Session, type TiltEvent, type JournalEntry, type ArenaEvent, type WarRoomDebate, type AchievementProgress, type ShadowTrade } from "./schema";

export const tradeRepo = {
  async save(trade: Trade): Promise<void> {
    await getDB().trades.put(trade);
  },

  async getById(id: string): Promise<Trade | undefined> {
    return getDB().trades.get(id);
  },

  async getBySession(sessionId: string): Promise<Trade[]> {
    return getDB().trades.where("sessionId").equals(sessionId).toArray();
  },

  async getRecent(limit = 50): Promise<Trade[]> {
    return getDB().trades.orderBy("timestamp").reverse().limit(limit).toArray();
  },

  async update(id: string, updates: Partial<Trade>): Promise<void> {
    await getDB().trades.update(id, updates);
  },

  async getByDateRange(start: number, end: number): Promise<Trade[]> {
    return getDB().trades
      .where("timestamp")
      .between(start, end)
      .toArray();
  },
};

export const phantomRepo = {
  async save(phantom: Phantom): Promise<void> {
    await getDB().phantoms.put(phantom);
  },

  async getActive(): Promise<Phantom[]> {
    return getDB().phantoms.where("status").equals("active").toArray();
  },

  async getBySession(sessionId: string): Promise<Phantom[]> {
    return getDB().phantoms.where("sessionId").equals(sessionId).toArray();
  },

  async update(id: string, updates: Partial<Phantom>): Promise<void> {
    await getDB().phantoms.update(id, updates);
  },

  async getResolved(limit = 100): Promise<Phantom[]> {
    return getDB().phantoms
      .where("status")
      .anyOf(["won", "lost", "expired"])
      .reverse()
      .limit(limit)
      .toArray();
  },
};

export const sessionRepo = {
  async createSession(): Promise<Session> {
    const now = Date.now();
    const session: Session = {
      id: nanoid(),
      date: new Date().toISOString().split("T")[0],
      startTime: now,
      tradeIds: [],
      phantomIds: [],
      tiltPeak: 0,
      narrativeGenerated: false,
    };
    await getDB().sessions.put(session);
    return session;
  },

  async getLatest(): Promise<Session | undefined> {
    return getDB().sessions.orderBy("startTime").last();
  },

  async getAll(): Promise<Session[]> {
    return getDB().sessions.orderBy("startTime").reverse().toArray();
  },

  async update(id: string, updates: Partial<Session>): Promise<void> {
    await getDB().sessions.update(id, updates);
  },
};

export const tiltEventRepo = {
  async save(event: Omit<TiltEvent, "id">): Promise<TiltEvent> {
    const full: TiltEvent = { ...event, id: nanoid() };
    await getDB().tiltEvents.put(full);
    return full;
  },

  async getBySession(sessionId: string): Promise<TiltEvent[]> {
    return getDB().tiltEvents.where("sessionId").equals(sessionId).toArray();
  },

  async getRecent(limit = 50): Promise<TiltEvent[]> {
    return getDB().tiltEvents.orderBy("timestamp").reverse().limit(limit).toArray();
  },
};

export const journalRepo = {
  async save(entry: JournalEntry): Promise<void> {
    await getDB().journalEntries.put(entry);
  },

  async getAll(): Promise<JournalEntry[]> {
    return getDB().journalEntries.orderBy("timestamp").reverse().toArray();
  },

  async search(query: string): Promise<JournalEntry[]> {
    const q = query.toLowerCase();
    const all = await getDB().journalEntries.toArray();
    return all.filter(
      (e) =>
        e.narrative.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  },

  async getByTag(tag: string): Promise<JournalEntry[]> {
    return getDB().journalEntries.where("tags").equals(tag).toArray();
  },

  async getBySession(sessionId: string): Promise<JournalEntry | undefined> {
    return getDB().journalEntries.where("sessionId").equals(sessionId).first();
  },
};

export const arenaEventRepo = {
  async save(event: Omit<ArenaEvent, "id">): Promise<ArenaEvent> {
    const full: ArenaEvent = { ...event, id: nanoid() };
    await getDB().arenaEvents.put(full);
    return full;
  },

  async getBySession(sessionId: string): Promise<ArenaEvent[]> {
    return getDB().arenaEvents.where("sessionId").equals(sessionId).toArray();
  },
};

export const warRoomRepo = {
  async save(debate: WarRoomDebate): Promise<void> {
    await getDB().warRoomDebates.put(debate);
  },

  async getBySession(sessionId: string): Promise<WarRoomDebate[]> {
    return getDB().warRoomDebates.where("sessionId").equals(sessionId).toArray();
  },

  async getRecent(limit = 20): Promise<WarRoomDebate[]> {
    return getDB().warRoomDebates.orderBy("timestamp").reverse().limit(limit).toArray();
  },

  async update(id: string, updates: Partial<WarRoomDebate>): Promise<void> {
    await getDB().warRoomDebates.update(id, updates);
  },
};

export const achievementRepo = {
  async getProgress(badgeId: string): Promise<AchievementProgress | undefined> {
    return getDB().achievementProgress.get(badgeId);
  },

  async getAllProgress(): Promise<AchievementProgress[]> {
    return getDB().achievementProgress.toArray();
  },

  async updateProgress(badgeId: string, updates: Partial<AchievementProgress>): Promise<void> {
    const existing = await getDB().achievementProgress.get(badgeId);
    if (existing) {
      await getDB().achievementProgress.update(badgeId, updates);
    } else {
      await getDB().achievementProgress.put({
        id: badgeId,
        badgeId,
        progress: 0,
        target1: 5,
        target2: 25,
        target3: 100,
        unlockedTier: 0,
        ...updates,
      });
    }
  },
};

export const shadowTradeRepo = {
  async save(trade: ShadowTrade): Promise<void> {
    await getDB().shadowTrades.put(trade);
  },

  async getBySession(sessionId: string): Promise<ShadowTrade[]> {
    return getDB().shadowTrades.where("sessionId").equals(sessionId).toArray();
  },

  async getRecent(limit = 50): Promise<ShadowTrade[]> {
    return getDB().shadowTrades.orderBy("startTime").reverse().limit(limit).toArray();
  },

  async getAll(): Promise<ShadowTrade[]> {
    return getDB().shadowTrades.orderBy("startTime").reverse().toArray();
  },
};

export { nanoid };
