'use strict';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadPaperLedgerFromStorage, PAPER_LEDGER_UPDATED_EVENT } from '@/lib/paper/storage';
import { closedPositionsChronological } from '@/lib/paper/tradeStats';
import type { PaperLedger } from '@/lib/paper/ledger';
import type { PaperPosition } from '@/lib/paper/ledger';

export interface PaperLedgerLiveStats {
  ledger: PaperLedger | null;
  closedCount: number;
  openCount: number;
  winRatePercent: number;
  totalPnl: number;
  /** Most recent closed legs */
  recentClosed: PaperPosition[];
}

function computeStats(ledger: PaperLedger | null): PaperLedgerLiveStats {
  if (!ledger) {
    return {
      ledger: null,
      closedCount: 0,
      openCount: 0,
      winRatePercent: 0,
      totalPnl: 0,
      recentClosed: [],
    };
  }
  const closed = closedPositionsChronological(ledger);
  const wins = closed.filter((p) => (p.pnl ?? 0) > 0).length;
  const winRatePercent = closed.length > 0 ? Math.round((wins / closed.length) * 1000) / 10 : 0;
  const totalPnl = closed.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const openCount = ledger.positions.filter((p) => p.status === 'open').length;
  return {
    ledger,
    closedCount: closed.length,
    openCount,
    winRatePercent,
    totalPnl,
    recentClosed: closed.slice(0, 25),
  };
}

/** Subscribe to paper ledger storage + same-tab Paper swarm saves */
export function usePaperLedgerLive(): PaperLedgerLiveStats {
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const onCustom = () => bump();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'derivarena-paper-ledger-v1') bump();
    };
    window.addEventListener(PAPER_LEDGER_UPDATED_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(PAPER_LEDGER_UPDATED_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
    };
  }, [bump]);

  return useMemo(() => computeStats(loadPaperLedgerFromStorage()), [tick]);
}
