'use strict';

import type { AgentProfileKnobs } from '../agents/types';
import type { TradeAction } from '../agents/types';
import {
  computePaperClosePnl,
  paperStepBlockedReason,
  type PaperRuleLimits,
} from './partnerEnforce';

export type PaperSide = 'CALL' | 'PUT';

export interface PaperPosition {
  id: string;
  symbol: string;
  side: PaperSide;
  stake: number;
  entryQuote: number;
  openedAt: number;
  openBar: number;
  closedAt?: number;
  exitQuote?: number;
  pnl?: number;
  status: 'open' | 'closed';
}

export interface PaperLedgerSnapshot {
  cash: number;
  /** Cash + open stakes + unrealized PnL at mark */
  equityApprox: number;
  positions: PaperPosition[];
}

export interface ApplyPaperStepParams {
  symbol: string;
  markQuote: number;
  action: TradeAction;
  confidence: number;
  knobs: AgentProfileKnobs;
  barIndex: number;
  /** Close any open leg after this many bars */
  maxOpenBars: number;
  /** Optional host caps — same semantics as Go `partner_rules` for paper simulation. */
  paperRuleLimits?: PaperRuleLimits;
  /** Wall time for daily-loss UTC window (defaults to `Date.now()`). */
  nowMs?: number;
}

export interface ApplyPaperStepResult {
  opened: PaperPosition | null;
  closed: PaperPosition[];
  ledger: PaperLedgerSnapshot;
  /** Set when the step was skipped to honor `paperRuleLimits`. */
  blockedReason?: string;
}

function newId(): string {
  const r = Math.floor(Math.random() * 1e9);
  return `P-${Date.now()}-${r}`;
}

function unrealizedPnL(p: PaperPosition, mark: number): number {
  if (p.status !== 'open' || p.entryQuote <= 0) return 0;
  if (p.side === 'CALL') {
    return p.stake * ((mark - p.entryQuote) / p.entryQuote);
  }
  return p.stake * ((p.entryQuote - mark) / p.entryQuote);
}

export class PaperLedger {
  positions: PaperPosition[] = [];
  cash: number;
  initialCash: number;

  constructor(initialCash: number) {
    if (!Number.isFinite(initialCash) || initialCash < 0) {
      throw new Error('PaperLedger: initialCash must be a non-negative finite number');
    }
    this.cash = initialCash;
    this.initialCash = initialCash;
  }

  snapshot(markQuote: number): PaperLedgerSnapshot {
    let unrealized = 0;
    let lockedStake = 0;
    for (const p of this.positions) {
      if (p.status === 'open') {
        lockedStake += p.stake;
        unrealized += unrealizedPnL(p, markQuote);
      }
    }
    return {
      cash: this.cash,
      equityApprox: this.cash + lockedStake + unrealized,
      positions: this.positions.map((x) => ({ ...x })),
    };
  }

  open(symbol: string, side: PaperSide, stake: number, entryQuote: number, barIndex: number): PaperPosition | null {
    if (stake <= 0 || stake > this.cash || !Number.isFinite(entryQuote) || entryQuote <= 0) {
      return null;
    }
    const pos: PaperPosition = {
      id: newId(),
      symbol,
      side,
      stake,
      entryQuote,
      openedAt: Date.now(),
      openBar: barIndex,
      status: 'open',
    };
    this.cash -= stake;
    this.positions.push(pos);
    return pos;
  }

  private closePosition(pos: PaperPosition, exitQuote: number): void {
    if (pos.status !== 'open' || exitQuote <= 0 || pos.entryQuote <= 0) return;
    const pnl = computePaperClosePnl(pos, exitQuote);
    pos.pnl = pnl;
    pos.exitQuote = exitQuote;
    pos.closedAt = Date.now();
    pos.status = 'closed';
    this.cash += pos.stake + pnl;
  }

  /**
   * Close legs on opposing signal or max holding bars; optionally open aligned with fused action.
   */
  applyPaperStep(params: ApplyPaperStepParams): ApplyPaperStepResult {
    const { symbol, markQuote, action, confidence, knobs, barIndex, maxOpenBars, paperRuleLimits, nowMs } = params;
    const t = nowMs ?? Date.now();
    const closed: PaperPosition[] = [];

    const toClose: PaperPosition[] = [];
    for (const p of this.positions) {
      if (p.status !== 'open' || p.symbol !== symbol) continue;
      const bars = barIndex - p.openBar;
      const tooLong = bars >= maxOpenBars;
      const oppose =
        (p.side === 'CALL' && action === 'PUT') || (p.side === 'PUT' && action === 'CALL');
      if (tooLong || oppose) {
        toClose.push(p);
      }
    }

    const closePnls = toClose.map((p) => computePaperClosePnl(p, markQuote));

    let projectedCash = this.cash;
    for (let i = 0; i < toClose.length; i++) {
      projectedCash += toClose[i]!.stake + closePnls[i]!;
    }

    const canTrade = confidence >= knobs.minConfidenceToTrade;
    const stake = knobs.defaultStake;
    const wouldKeepOpen = this.positions.some(
      (p) => p.symbol === symbol && p.status === 'open' && !toClose.includes(p),
    );
    const stakeOkAfterCloses = stake > 0 && stake <= knobs.maxStake && stake <= projectedCash;
    const willTryOpen =
      !wouldKeepOpen && canTrade && stakeOkAfterCloses && (action === 'CALL' || action === 'PUT');
    const wouldOpenStake = willTryOpen ? stake : null;

    const blocked = paperStepBlockedReason(paperRuleLimits, this, closePnls, wouldOpenStake, t);
    if (blocked) {
      return {
        opened: null,
        closed: [],
        ledger: this.snapshot(markQuote),
        blockedReason: blocked,
      };
    }

    for (const p of toClose) {
      this.closePosition(p, markQuote);
      closed.push({ ...p });
    }

    let opened: PaperPosition | null = null;
    const hasOpenNow = this.positions.some((p) => p.symbol === symbol && p.status === 'open');
    const stakeOk = stake > 0 && stake <= knobs.maxStake && stake <= this.cash;
    if (!hasOpenNow && canTrade && stakeOk && (action === 'CALL' || action === 'PUT')) {
      const side: PaperSide = action === 'CALL' ? 'CALL' : 'PUT';
      opened = this.open(symbol, side, stake, markQuote, barIndex);
    }

    return {
      opened,
      closed,
      ledger: this.snapshot(markQuote),
    };
  }
}
