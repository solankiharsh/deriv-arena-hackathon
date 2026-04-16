'use strict';

import { describe, expect, it } from 'vitest';
import { DEFAULT_KNOBS } from '../agents';
import { PaperLedger } from './ledger';
import { partnerRulesToPaperLimits } from './partnerEnforce';

describe('PaperLedger', () => {
  it('rejects open when stake exceeds cash', () => {
    const L = new PaperLedger(5);
    expect(L.open('1HZ100V', 'CALL', 10, 1000, 0)).toBeNull();
  });

  it('computes realized PnL for CALL on favorable exit', () => {
    const L = new PaperLedger(1000);
    const p = L.open('1HZ100V', 'CALL', 100, 1000, 0);
    expect(p).not.toBeNull();
    expect(L.cash).toBe(900);
    const r = L.applyPaperStep({
      symbol: '1HZ100V',
      markQuote: 1010,
      action: 'PUT',
      confidence: 1,
      knobs: { ...DEFAULT_KNOBS, minConfidenceToTrade: 1.01 },
      barIndex: 1,
      maxOpenBars: 99,
    });
    expect(r.closed).toHaveLength(1);
    expect(r.closed[0].pnl).toBeDefined();
    expect(r.closed[0].pnl!).toBeCloseTo(100 * (10 / 1000), 5);
    expect(L.cash).toBeCloseTo(900 + 100 + 100 * (10 / 1000), 5);
  });

  it('closes on maxOpenBars with HOLD', () => {
    const L = new PaperLedger(500);
    L.open('R_50', 'PUT', 50, 5000, 0);
    const r = L.applyPaperStep({
      symbol: 'R_50',
      markQuote: 4990,
      action: 'HOLD',
      confidence: 0,
      knobs: DEFAULT_KNOBS,
      barIndex: 5,
      maxOpenBars: 5,
    });
    expect(r.closed.length).toBeGreaterThanOrEqual(1);
  });

  it('blocks open when partner max_stake_per_contract is lower than default stake', () => {
    const L = new PaperLedger(10_000);
    const knobs = {
      ...DEFAULT_KNOBS,
      minConfidenceToTrade: 0.1,
      maxStake: 500,
      defaultStake: 150,
    };
    const limits = partnerRulesToPaperLimits({
      max_stake_per_contract: '100',
    });
    const r = L.applyPaperStep({
      symbol: '1HZ100V',
      markQuote: 1000,
      action: 'CALL',
      confidence: 0.9,
      knobs,
      barIndex: 0,
      maxOpenBars: 20,
      paperRuleLimits: limits,
    });
    expect(r.blockedReason).toBe('max_stake_per_contract');
    expect(r.opened).toBeNull();
    expect(L.positions).toHaveLength(0);
  });

  it('does not double-open same symbol', () => {
    const L = new PaperLedger(200);
    const knobs = { ...DEFAULT_KNOBS, minConfidenceToTrade: 0.1, defaultStake: 20 };
    L.applyPaperStep({
      symbol: '1HZ100V',
      markQuote: 100,
      action: 'CALL',
      confidence: 0.9,
      knobs,
      barIndex: 0,
      maxOpenBars: 20,
    });
    const r2 = L.applyPaperStep({
      symbol: '1HZ100V',
      markQuote: 101,
      action: 'CALL',
      confidence: 0.9,
      knobs,
      barIndex: 1,
      maxOpenBars: 20,
    });
    expect(r2.opened).toBeNull();
    const openCount = L.positions.filter((p) => p.symbol === '1HZ100V' && p.status === 'open').length;
    expect(openCount).toBe(1);
  });
});
