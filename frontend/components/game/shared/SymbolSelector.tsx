'use client';

import { useState, useMemo, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, XCircle, Wifi, WifiOff } from 'lucide-react';
import { useTradeStore } from '@/lib/stores/trade-store';
import { derivWS } from '@/lib/deriv/websocket';
import { fetchActiveSymbols } from '@/lib/deriv/symbols';

const FALLBACK_SYMBOLS = [
  'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
  '1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V',
  'RDBULL', 'RDBEAR',
].map((symbol) => ({
  symbol,
  display_name: symbol.replace(/_/g, ' ').replace(/^R /, 'Volatility ').replace(/^1HZ/, 'Volatility '),
  market: 'synthetic_index',
  market_display_name: 'Synthetic Indices',
  submarket: 'random_index',
  submarket_display_name: 'Continuous Indices',
  pip: 0.01,
  exchange_is_open: 1,
  allow_forward_starting: 0,
  is_trading_suspended: 0,
  symbol_type: 'stockindex',
}));

interface SymbolSelectorProps {
  compact?: boolean;
}

export function SymbolSelector({ compact = false }: SymbolSelectorProps) {
  const {
    selectedAsset, availableSymbols,
    setSelectedAsset, setAvailableSymbols,
  } = useTradeStore();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [connected, setConnected] = useState(derivWS.connected);
  const [portalReady, setPortalReady] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const loadSymbols = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      await fetchActiveSymbols();
      if (useTradeStore.getState().availableSymbols.length > 0) return;
      setAvailableSymbols(FALLBACK_SYMBOLS as Parameters<typeof setAvailableSymbols>[0]);
    } catch {
      if (useTradeStore.getState().availableSymbols.length === 0) {
        setAvailableSymbols(FALLBACK_SYMBOLS as Parameters<typeof setAvailableSymbols>[0]);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [setAvailableSymbols]);

  const updateDropdownPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDropdownStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const unsub = derivWS.onConnectionChange((nextConnected) => {
      setConnected(nextConnected);
      if (nextConnected) {
        loadSymbols();
      }
    });
    return unsub;
  }, [loadSymbols]);

  useEffect(() => {
    if (availableSymbols.length === 0) {
      loadSymbols();
    }
  }, [availableSymbols.length, loadSymbols]);

  useEffect(() => {
    if (open) {
      loadSymbols();
    }
  }, [open, loadSymbols]);

  const displayName = useMemo(() =>
    availableSymbols.find((s) => s.symbol === selectedAsset)?.display_name ?? selectedAsset,
    [availableSymbols, selectedAsset]
  );

  const groupedSymbols = useMemo(() => {
    const query = search.toLowerCase();
    const syms = availableSymbols.length > 0 ? availableSymbols : FALLBACK_SYMBOLS;
    const filtered = syms.filter(
      (s) =>
        s.display_name.toLowerCase().includes(query) ||
        s.symbol.toLowerCase().includes(query) ||
        s.market_display_name.toLowerCase().includes(query)
    );
    const groups = new Map<string, typeof filtered>();
    for (const sym of filtered) {
      const key = sym.market_display_name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(sym);
    }
    return groups;
  }, [availableSymbols, search]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);
      if (!clickedTrigger && !clickedPanel) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    updateDropdownPosition();

    const syncPosition = () => updateDropdownPosition();
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    return () => {
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
    };
  }, [open, updateDropdownPosition]);

  const dropdown = (
    <AnimatePresence>
      {open && dropdownStyle && portalReady && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[9999] rounded-xl shadow-2xl max-h-96 flex flex-col overflow-hidden border border-white/[0.08]"
          style={{
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            width: dropdownStyle.width,
            background: 'rgba(12, 12, 20, 0.98)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div className="p-2 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search markets..."
                className="w-full h-8 pl-7 pr-8 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/30"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <XCircle className="w-3.5 h-3.5 text-text-muted" />
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-scroll flex-1 scrollbar-custom" style={{ overscrollBehavior: 'contain' }}>
            {groupedSymbols.size === 0 ? (
              <div className="p-4 text-center text-xs text-text-muted">
                {availableSymbols.length === 0
                  ? 'Connecting to Deriv...'
                  : `No symbols match "${search}"`}
              </div>
            ) : (
              Array.from(groupedSymbols.entries()).map(([market, syms]) => (
                <div key={market}>
                  <div
                    className="px-3 py-1.5 text-[8px] font-black text-text-muted uppercase tracking-[0.15em] sticky top-0"
                    style={{ background: 'rgba(12, 12, 20, 0.95)' }}
                  >
                    {market}
                    <span className="ml-1 opacity-50">({syms.length})</span>
                  </div>
                  {syms.map((sym) => (
                    <button
                      key={sym.symbol}
                      type="button"
                      onClick={() => {
                        setSelectedAsset(sym.symbol);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                        sym.symbol === selectedAsset
                          ? 'bg-accent-primary/10 border-l-2 border-accent-primary'
                          : 'hover:bg-white/[0.04] border-l-2 border-transparent'
                      }`}
                    >
                      <span className={`text-xs font-medium ${
                        sym.symbol === selectedAsset ? 'text-accent-primary' : 'text-text-primary'
                      }`}>
                        {sym.display_name}
                      </span>
                      <div className="flex items-center gap-2">
                        {sym.exchange_is_open ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        )}
                        <span className="text-[9px] font-mono text-text-muted">{sym.symbol}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative z-[60]" ref={pickerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((currentOpen) => !currentOpen);
          setSearch('');
        }}
        className={`w-full flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] transition-colors ${
          compact ? 'p-2.5' : 'p-3'
        }`}
      >
        <div className="text-left min-w-0">
          <div className="text-[9px] text-text-muted uppercase tracking-wider mb-0.5">Asset</div>
          <div className={`font-bold text-text-primary truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {displayName}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {connected ? (
            <Wifi className="w-2.5 h-2.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-2.5 h-2.5 text-red-400" />
          )}
          <span className="text-[9px] text-text-muted font-mono">{selectedAsset}</span>
          <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {portalReady ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
