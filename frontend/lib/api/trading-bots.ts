import type { AutoStopMode, BotAgentPolicy } from '@/lib/botAgentPolicy';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

export interface IndicatorsConfig {
  technical: string[];
  aiPatterns: boolean;
  newsWeight: number;
}

export interface ExecutionConfig {
  stakeAmount: number;
  maxDailyTrades: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  /** Session profit target (USD); 0 = unused for auto-stop */
  targetPayoutUsd: number;
  /** 0–100; max session loss = paperBankroll * (this/100) */
  riskTolerancePercent: number;
  /** Notional bankroll for risk % (synthetic) */
  paperBankroll: number;
  autoStopMode: AutoStopMode;
}

export interface TimeRestrictions {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface BotConfig {
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  marketSelection: string[];
  /** Synthetic FX/crypto/rise-fall tickers (separate from volatility indices) */
  assetSelection?: string[];
  contractTypes: string[];
  indicators: IndicatorsConfig;
  execution: ExecutionConfig;
  newsFilters: string[];
  timeRestrictions: TimeRestrictions;
  enabledFeeds?: Record<string, boolean>;
  /** Optional paper-agent-style policy layer */
  agentPolicy?: BotAgentPolicy;
}

export interface Bot {
  id: string;
  user_id: string;
  name: string;
  status: 'stopped' | 'running' | 'paused' | 'error';
  execution_mode: 'paper' | 'demo_live';
  config: BotConfig;
  level: number;
  xp: number;
  win_streak: number;
  best_streak: number;
  unlocked_features: string[];
  created_at: string;
  updated_at: string;
  started_at?: string | null;
  stopped_at?: string | null;
}

export interface BotTrade {
  id: string;
  bot_id: string;
  symbol: string;
  contract_type: string;
  side: 'BUY' | 'SELL';
  stake: string;
  payout?: string | null;
  pnl?: string | null;
  entry_price?: string | null;
  exit_price?: string | null;
  execution_mode: string;
  signal_sources: Record<string, any>;
  xp_gained: number;
  executed_at: string;
  closed_at?: string | null;
  metadata?: Record<string, any>;
}

export interface BotAnalytics {
  bot_id: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  total_pnl: string;
  win_rate: string;
  avg_win: string;
  avg_loss: string;
  max_drawdown: string;
  sharpe_ratio?: string | null;
  profit_factor?: string | null;
  last_trade_at?: string | null;
  updated_at: string;
}

export interface BotSignalLog {
  id: string;
  bot_id: string;
  signal_type: string;
  signal_data: Record<string, any>;
  action_taken: string;
  confidence: number;
  created_at: string;
}

function withUser(url: string, userId: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}user_id=${encodeURIComponent(userId)}`;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const data = await res.json();
  if (data && typeof data === 'object' && data.success === false) {
    throw new Error(data.error || 'Unknown error');
  }
  if (data && typeof data === 'object' && 'data' in data) {
    return (data as { data: T }).data as T;
  }
  return data as T;
}

export async function listBots(userId: string): Promise<Bot[]> {
  const bots = await apiFetch<Bot[] | null>(withUser(`${API_URL}/api/bots/`, userId));
  return bots || [];
}

export async function getBot(userId: string, botId: string): Promise<Bot> {
  return apiFetch<Bot>(withUser(`${API_URL}/api/bots/${botId}`, userId));
}

export async function createBot(
  userId: string,
  payload: { name: string; execution_mode: string; config: BotConfig }
): Promise<Bot> {
  return apiFetch<Bot>(`${API_URL}/api/bots/`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, ...payload }),
  });
}

export async function deleteBot(userId: string, botId: string): Promise<void> {
  await apiFetch(withUser(`${API_URL}/api/bots/${botId}`, userId), { method: 'DELETE' });
}

export async function startBot(userId: string, botId: string): Promise<void> {
  await apiFetch(withUser(`${API_URL}/api/bots/${botId}/start`, userId), { method: 'POST' });
}
export async function stopBot(userId: string, botId: string): Promise<void> {
  await apiFetch(withUser(`${API_URL}/api/bots/${botId}/stop`, userId), { method: 'POST' });
}
export async function pauseBot(userId: string, botId: string): Promise<void> {
  await apiFetch(withUser(`${API_URL}/api/bots/${botId}/pause`, userId), { method: 'POST' });
}
export async function resumeBot(userId: string, botId: string): Promise<void> {
  await apiFetch(withUser(`${API_URL}/api/bots/${botId}/resume`, userId), { method: 'POST' });
}

export async function getBotTrades(userId: string, botId: string, limit = 100): Promise<BotTrade[]> {
  const trades = await apiFetch<BotTrade[] | null>(
    withUser(`${API_URL}/api/bots/${botId}/trades?limit=${limit}`, userId)
  );
  return trades || [];
}

export async function getBotAnalytics(userId: string, botId: string): Promise<BotAnalytics> {
  return apiFetch<BotAnalytics>(withUser(`${API_URL}/api/bots/${botId}/analytics`, userId));
}

export async function getBotSignals(userId: string, botId: string, limit = 100): Promise<BotSignalLog[]> {
  const sigs = await apiFetch<BotSignalLog[] | null>(
    withUser(`${API_URL}/api/bots/${botId}/signals?limit=${limit}`, userId)
  );
  return sigs || [];
}

export async function getBotFeedData(userId: string, botId: string, feedId: string): Promise<any> {
  return apiFetch(withUser(`${API_URL}/api/bots/${botId}/feed/${feedId}`, userId));
}

export async function toggleBotFeed(
  userId: string,
  botId: string,
  feedId: string,
  enabled: boolean
): Promise<{ enabled: boolean }> {
  return apiFetch(withUser(`${API_URL}/api/bots/${botId}/feed/${feedId}/toggle`, userId), {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export function botStreamUrl(userId: string, botId: string): string {
  const base = API_URL.replace(/^http/i, 'ws');
  return `${base}/api/bots/${encodeURIComponent(botId)}/stream?user_id=${encodeURIComponent(userId)}`;
}

export function defaultBotConfig(): BotConfig {
  return {
    riskProfile: 'moderate',
    marketSelection: ['VOL100-USD'],
    assetSelection: [],
    contractTypes: ['CALL', 'PUT'],
    indicators: {
      technical: ['rsi'],
      aiPatterns: false,
      newsWeight: 0.3,
    },
    execution: {
      stakeAmount: 10,
      maxDailyTrades: 20,
      stopLossPercent: 5,
      takeProfitPercent: 10,
      targetPayoutUsd: 100,
      riskTolerancePercent: 50,
      paperBankroll: 10000,
      autoStopMode: 'first_hit',
    },
    newsFilters: [],
    timeRestrictions: { enabled: false, startHour: 9, endHour: 17 },
    enabledFeeds: { deriv_ticks: true, sentiment: true, pattern: true, partner: true },
  };
}
