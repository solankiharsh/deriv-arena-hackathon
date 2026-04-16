'use strict';

/** Same key as join flow — stable per browser for demo competitions. */
export const DERIVARENA_TRADER_ID_KEY = 'derivarena_trader_id';

export function getOrCreateTraderId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DERIVARENA_TRADER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DERIVARENA_TRADER_ID_KEY, id);
  }
  return id;
}
