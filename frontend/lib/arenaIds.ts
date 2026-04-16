'use strict';

/** Synthetic leaderboard row for local paper trading (no `/arena` backend row). */
export const PAPER_LAB_AGENT_ID = 'derivarena-paper-lab';

export function isPaperLabAgentId(id: string | null | undefined): boolean {
  return id === PAPER_LAB_AGENT_ID;
}
