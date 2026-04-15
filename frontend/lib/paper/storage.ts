'use strict';

import { PaperLedger, type PaperPosition } from './ledger';

const STORAGE_KEY = 'derivarena-paper-ledger-v1';

export interface SerializedPaperState {
  version: 1;
  initialCash: number;
  cash: number;
  positions: PaperPosition[];
}

export function serializePaperLedger(ledger: PaperLedger): SerializedPaperState {
  return {
    version: 1,
    initialCash: ledger.initialCash,
    cash: ledger.cash,
    positions: ledger.positions.map((p) => ({ ...p })),
  };
}

export function deserializePaperLedger(data: unknown): PaperLedger | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as SerializedPaperState;
  if (o.version !== 1 || typeof o.cash !== 'number' || typeof o.initialCash !== 'number') return null;
  if (!Array.isArray(o.positions)) return null;
  const ledger = new PaperLedger(o.initialCash);
  ledger.cash = o.cash;
  ledger.positions = o.positions.filter((p) => p && typeof p === 'object' && 'id' in p) as PaperPosition[];
  return ledger;
}

export function loadPaperLedgerFromStorage(): PaperLedger | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return deserializePaperLedger(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function savePaperLedgerToStorage(ledger: PaperLedger): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializePaperLedger(ledger)));
  } catch {
    /* quota or private mode */
  }
}

export function clearPaperLedgerStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export { STORAGE_KEY };
