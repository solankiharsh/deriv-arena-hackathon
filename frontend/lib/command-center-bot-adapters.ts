/**
 * Maps trading-bot API data into shapes used by Command Center (AgentDataFlow)
 * when legacy /arena/* and /messaging/* endpoints return nothing.
 */
import type { AgentConversationSummary, AgentTaskType, Position } from '@/lib/types';
import type { BotSignalLog, BotTrade } from '@/lib/api/trading-bots';
import { ARENA_QUESTS, type ArenaQuestId } from '@/lib/arena-quest-definitions';

const MAX_SIGNAL_TASKS = 20;
const MAX_CLOSED_POSITION_ROWS = 12;
const MAX_ACTIVITY = 25;
const SIGNAL_LOOKBACK_MS = 48 * 60 * 60 * 1000;

/** Arena + bot stats used to mark marketing quests complete (heuristic; no dedicated quest API yet). */
export interface QuestProgressContext {
  totalGames: number;
  totalWins: number;
  tradeCount: number;
  botWinStreak: number;
}

function isQuestDone(id: ArenaQuestId, ctx: QuestProgressContext): boolean {
  switch (id) {
    case 'join_competition':
    case 'first_game':
    case 'finish_match':
      return ctx.totalGames >= 1;
    case 'first_trade':
      return ctx.tradeCount >= 1;
    case 'win_streak':
      return ctx.botWinStreak >= 2 || ctx.totalWins >= 2;
    case 'share_link':
    case 'referral':
      return false;
    default:
      return false;
  }
}

/** Marketing-aligned task rows when the legacy arena task API returns nothing. */
export function buildArenaQuestTasks(ctx: QuestProgressContext): AgentTaskType[] {
  const rows: AgentTaskType[] = ARENA_QUESTS.map((q) => {
    const done = isQuestDone(q.id, ctx);
    return {
      taskId: `quest-${q.id}`,
      tokenMint: null,
      taskType: 'quest',
      title: q.title,
      xpReward: q.points,
      status: done ? 'COMPLETED' : 'OPEN',
      completions: [],
      createdAt: new Date().toISOString(),
    };
  });
  return rows.sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === 'OPEN' ? -1 : 1;
  });
}

function parseNum(s: string | undefined | null): number {
  if (s == null || s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function previewFromSignalData(data: Record<string, unknown>): string {
  if (!data || typeof data !== 'object') return '';
  const note = data.notes ?? data.reason ?? data.summary;
  if (typeof note === 'string' && note.length > 0) return note.slice(0, 120);
  try {
    return JSON.stringify(data).slice(0, 100);
  } catch {
    return '';
  }
}

/** Small XP hint for signal rows when shown (secondary to arena quests). */
function xpHintForSignal(s: BotSignalLog): number {
  if (s.action_taken === 'trade_executed') return 25;
  if (s.action_taken === 'signal_generated' || s.action_taken === 'analyzed') return 12;
  return 15;
}

/** Recent bot signals as optional secondary rows (not the primary Command Center task list). */
export function signalsToAgentTasks(signals: BotSignalLog[]): AgentTaskType[] {
  const now = Date.now();
  const cutoff = now - SIGNAL_LOOKBACK_MS;
  const filtered = signals
    .filter((s) => {
      const t = new Date(s.created_at).getTime();
      return Number.isFinite(t) && t >= cutoff;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, MAX_SIGNAL_TASKS);

  return filtered.map((s) => {
    const sym = extractSymbol(s.signal_data);
    const title = sym
      ? `${formatSignalType(s.signal_type)} · ${sym}`
      : formatSignalType(s.signal_type);
    const status: AgentTaskType['status'] =
      s.action_taken === 'trade_executed' ? 'CLAIMED' : 'OPEN';
    return {
      taskId: `sig-${s.id}`,
      tokenMint: null,
      tokenSymbol: sym,
      taskType: s.signal_type,
      title,
      xpReward: xpHintForSignal(s),
      status,
      completions: [],
      createdAt: s.created_at,
    };
  });
}

function formatSignalType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatAction(a: string): string {
  return a.replace(/_/g, ' ');
}

function extractSymbol(data: Record<string, unknown>): string | undefined {
  const sym = data.symbol ?? data.market ?? data.asset;
  if (typeof sym === 'string' && sym.length > 0) return sym;
  return undefined;
}

/** Map trades → Position rows; open contracts first, then recent closed. */
export function tradesToPositions(
  trades: BotTrade[],
  agentId: string,
  agentName: string
): Position[] {
  const open = trades.filter((t) => !t.closed_at);
  const closed = trades
    .filter((t) => t.closed_at)
    .sort((a, b) => new Date(b.closed_at!).getTime() - new Date(a.closed_at!).getTime());

  const ordered = [...open, ...closed.slice(0, MAX_CLOSED_POSITION_ROWS)];

  return ordered.map((t) => {
    const stake = parseNum(t.stake);
    const pnl = parseNum(t.pnl ?? undefined);
    const entry = parseNum(t.entry_price ?? undefined);
    const exitPx = parseNum(t.exit_price ?? undefined);
    const isOpen = !t.closed_at;
    const currentPx = isOpen ? (entry || exitPx) : (exitPx || entry);
    const pnlPct = stake > 0 ? (pnl / stake) * 100 : 0;
    const currentValue = stake + (isOpen ? 0 : pnl);

    return {
      positionId: `trade-${t.id}`,
      agentId,
      agentName,
      tokenMint: '',
      tokenSymbol: t.symbol || '—',
      quantity: 1,
      entryPrice: entry || 0,
      currentPrice: currentPx || currentValue || 0,
      currentValue: Math.abs(currentValue) < 1e-9 ? stake : currentValue,
      pnl: isOpen ? 0 : pnl,
      pnlPercent: isOpen ? 0 : pnlPct,
      openedAt: t.executed_at,
      closedAt: t.closed_at ?? undefined,
    };
  });
}

/** Signal log as Activity tab rows (reuses conversation summary shape). */
export function signalsToActivitySummaries(signals: BotSignalLog[]): AgentConversationSummary[] {
  const sorted = [...signals].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sorted.slice(0, MAX_ACTIVITY).map((s) => {
    const preview = previewFromSignalData(s.signal_data);
    const line = [formatAction(s.action_taken), preview].filter(Boolean).join(' · ');
    return {
      conversationId: `sig-act-${s.id}`,
      topic: formatSignalType(s.signal_type),
      tokenMint: undefined,
      participantCount: 1,
      messageCount: 0,
      lastMessage: line || '—',
      lastMessageAt: s.created_at,
      agentMessageCount: Math.round(Math.min(100, Math.max(0, (s.confidence ?? 0) * 100))),
      createdAt: s.created_at,
    };
  });
}

export function mergeAgentTasks(
  arena: AgentTaskType[],
  signals: BotSignalLog[],
  questCtx?: QuestProgressContext
): AgentTaskType[] {
  if (arena.length > 0) return arena;
  const quests = questCtx ? buildArenaQuestTasks(questCtx) : [];
  if (quests.length > 0) return quests;
  return signalsToAgentTasks(signals);
}

export function mergePositions(
  arena: Position[],
  trades: BotTrade[],
  agentId: string,
  agentName: string
): Position[] {
  if (arena.length > 0) return arena;
  const adapted = tradesToPositions(trades, agentId, agentName);
  if (adapted.length > 0) return adapted;
  return [];
}

export function mergeActivity(
  arena: AgentConversationSummary[],
  signals: BotSignalLog[]
): AgentConversationSummary[] {
  if (arena.length > 0) return arena;
  return signalsToActivitySummaries(signals);
}
