'use strict';

export type { ApplyPaperStepParams, ApplyPaperStepResult, PaperLedgerSnapshot, PaperPosition, PaperSide } from './ledger';
export { PaperLedger } from './ledger';
export type { PaperRuleLimits } from './partnerEnforce';
export {
  partnerRulesToPaperLimits,
  computePaperClosePnl,
  sumAbsPaperLossesUtcDay,
  maxDrawdownPctAlongPath,
  maxDrawdownPercentAfterAdditionalPnls,
  paperStepBlockedReason,
} from './partnerEnforce';
export {
  clearPaperLedgerStorage,
  deserializePaperLedger,
  loadPaperLedgerFromStorage,
  PAPER_LEDGER_UPDATED_EVENT,
  savePaperLedgerToStorage,
  serializePaperLedger,
  STORAGE_KEY,
} from './storage';
export { paperLedgerToLeaderAgent } from './paperLeaderboard';
export {
  getPaperMirrorCompetitionId,
  isPaperMirrorPostingEnabled,
  mirrorPaperClosesToCompetition,
  setPaperMirrorCompetitionId,
  setPaperMirrorPostingEnabled,
} from './competitionMirror';
export { closedPositionsChronological, recentWinRate, winStreakFromLedger } from './tradeStats';
