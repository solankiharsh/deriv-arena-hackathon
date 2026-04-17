import { create } from 'zustand';
import {
  listBots,
  createBot as apiCreateBot,
  getBot as apiGetBot,
  deleteBot as apiDeleteBot,
  startBot as apiStartBot,
  stopBot as apiStopBot,
  pauseBot as apiPauseBot,
  resumeBot as apiResumeBot,
  getBotTrades as apiGetBotTrades,
  getBotAnalytics as apiGetBotAnalytics,
  getBotSignals as apiGetBotSignals,
  toggleBotFeed as apiToggleBotFeed,
  getBotFeedData as apiGetBotFeedData,
  type Bot,
  type BotConfig,
  type BotTrade,
  type BotAnalytics,
  type BotSignalLog,
} from '@/lib/api/trading-bots';

interface BotState {
  bots: Bot[];
  selectedBotId: string | null;
  trades: Record<string, BotTrade[]>;
  analytics: Record<string, BotAnalytics>;
  signals: Record<string, BotSignalLog[]>;
  loading: boolean;
  error: string | null;

  fetchBots: (userId: string) => Promise<void>;
  createBot: (userId: string, payload: { name: string; execution_mode: string; config: BotConfig }) => Promise<Bot | null>;
  deleteBot: (userId: string, botId: string) => Promise<void>;
  startBot: (userId: string, botId: string) => Promise<void>;
  stopBot: (userId: string, botId: string) => Promise<void>;
  pauseBot: (userId: string, botId: string) => Promise<void>;
  resumeBot: (userId: string, botId: string) => Promise<void>;

  fetchTrades: (userId: string, botId: string, limit?: number) => Promise<void>;
  fetchAnalytics: (userId: string, botId: string) => Promise<void>;
  fetchSignals: (userId: string, botId: string) => Promise<void>;

  selectBot: (botId: string | null) => void;
  applyTradeEvent: (botId: string, trade: BotTrade) => void;
  applyAnalyticsEvent: (botId: string, a: BotAnalytics) => void;
  applyLevelUpEvent: (botId: string, level: number, xp: number, features: string[]) => void;
  applyStatusEvent: (botId: string, status: string) => void;
}

export const useBotStore = create<BotState>((set, get) => ({
  bots: [],
  selectedBotId: null,
  trades: {},
  analytics: {},
  signals: {},
  loading: false,
  error: null,

  fetchBots: async (userId) => {
    if (!userId) return;
    set({ loading: true, error: null });
    try {
      const bots = await listBots(userId);
      set({ bots: Array.isArray(bots) ? bots : [], loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.message || 'Failed to load bots' });
    }
  },

  createBot: async (userId, payload) => {
    try {
      const bot = await apiCreateBot(userId, payload);
      set((s) => ({ bots: [bot, ...s.bots] }));
      return bot;
    } catch (e: any) {
      set({ error: e?.message || 'Failed to create bot' });
      return null;
    }
  },

  deleteBot: async (userId, botId) => {
    try {
      await apiDeleteBot(userId, botId);
      set((s) => ({ bots: s.bots.filter((b) => b.id !== botId) }));
    } catch (e: any) {
      set({ error: e?.message || 'Failed to delete bot' });
    }
  },

  startBot: async (userId, botId) => {
    await apiStartBot(userId, botId);
    await get().fetchBots(userId);
  },
  stopBot: async (userId, botId) => {
    await apiStopBot(userId, botId);
    await get().fetchBots(userId);
  },
  pauseBot: async (userId, botId) => {
    await apiPauseBot(userId, botId);
    await get().fetchBots(userId);
  },
  resumeBot: async (userId, botId) => {
    await apiResumeBot(userId, botId);
    await get().fetchBots(userId);
  },

  fetchTrades: async (userId, botId, limit = 100) => {
    const trades = await apiGetBotTrades(userId, botId, limit);
    set((s) => ({ trades: { ...s.trades, [botId]: trades } }));
  },
  fetchAnalytics: async (userId, botId) => {
    const a = await apiGetBotAnalytics(userId, botId);
    set((s) => ({ analytics: { ...s.analytics, [botId]: a } }));
  },
  fetchSignals: async (userId, botId) => {
    const sigs = await apiGetBotSignals(userId, botId);
    set((s) => ({ signals: { ...s.signals, [botId]: sigs } }));
  },

  selectBot: (botId) => set({ selectedBotId: botId }),

  applyTradeEvent: (botId, trade) =>
    set((s) => ({
      trades: { ...s.trades, [botId]: [trade, ...(s.trades[botId] || [])].slice(0, 200) },
    })),
  applyAnalyticsEvent: (botId, a) =>
    set((s) => ({ analytics: { ...s.analytics, [botId]: a } })),
  applyLevelUpEvent: (botId, level, xp, features) =>
    set((s) => ({
      bots: s.bots.map((b) =>
        b.id === botId ? { ...b, level, xp, unlocked_features: features } : b
      ),
    })),
  applyStatusEvent: (botId, status) =>
    set((s) => ({
      bots: s.bots.map((b) => (b.id === botId ? { ...b, status: status as Bot['status'] } : b)),
    })),
}));

export { apiToggleBotFeed, apiGetBotFeedData };
