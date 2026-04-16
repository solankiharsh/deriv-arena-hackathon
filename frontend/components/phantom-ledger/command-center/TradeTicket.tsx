"use client";

import { useState, useRef, useMemo, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Loader2, ChevronDown, XCircle, Search } from "lucide-react";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useTiltStore } from "@/lib/stores/tilt-store";
import { formatCurrency } from "@/lib/utils/formatters";
import { TILT_ZONE_COLORS } from "@/lib/engines/tilt-detection";
import { placeSimulatedTrade, sellSimulatedTradeEarly } from "@/lib/engines/trade-simulator";
import { evaluateAndCapture } from "@/lib/engines/phantom-tracker";
import type { CaptureSignal } from "@/lib/engines/phantom-capture";
import {
  fetchContractsForAsset,
  fetchProposalPreview,
  fetchMarketHours,
  type ContractAvailability,
  type ProposalPreview,
} from "@/lib/deriv/market-intelligence";
import type { ContractType } from "@/lib/deriv/types";

const DURATION_PRESETS = [
  { label: "1m", value: 1, unit: "m" },
  { label: "5m", value: 5, unit: "m" },
  { label: "15m", value: 15, unit: "m" },
  { label: "1h", value: 60, unit: "m" },
];

const DEFAULT_STAKE = 10;
const INACTIVITY_TIMEOUT_MS = 30_000;

export function TradeTicket() {
  const {
    selectedAsset,
    selectedDirection,
    selectedStake,
    selectedDuration,
    selectedDurationUnit,
    availableSymbols,
    activePosition,
    setSelectedAsset,
    setSelectedDirection,
    setSelectedStake,
    setSelectedDuration,
  } = useTradeStore();

  const { score: tiltScore, zone: tiltZone } = useTiltStore();
  const [isPlacingTrade, setIsPlacingTrade] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const [portalReady, setPortalReady] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const [availableContracts, setAvailableContracts] = useState<ContractAvailability[]>([]);
  const [proposalPreview, setProposalPreview] = useState<ProposalPreview | null>(null);
  const [marketHours, setMarketHours] = useState<string | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [proposalLoading, setProposalLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const buyButtonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerPanelRef = useRef<HTMLDivElement>(null);

  // ── Phantom signal tracking refs ──
  const formOpenedAt = useRef(Date.now());
  const assetViewedAt = useRef(Date.now());
  const directionWasSelected = useRef(false);
  const stakeWasModified = useRef(false);
  const buttonHoverStart = useRef<number | null>(null);
  const cumulativeHoverMs = useRef(0);
  const closestProximityPx = useRef(Infinity);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevAssetRef = useRef(selectedAsset);
  const tradePlacedRef = useRef(false);
  const prevDirectionRef = useRef(selectedDirection);
  const maxStakeRef = useRef(selectedStake);

  const tiltColor = TILT_ZONE_COLORS[tiltZone];
  const showTiltWarning = tiltScore > 40;
  const isOnTilt = tiltScore > 60;

  const displayName =
    availableSymbols.find((s) => s.symbol === selectedAsset)?.display_name ?? selectedAsset;

  const groupedSymbols = useMemo(() => {
    const query = assetSearch.toLowerCase();
    const filtered = availableSymbols.filter(
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
  }, [availableSymbols, assetSearch]);

  const updateDropdownPosition = useCallback(() => {
    const rect = pickerRef.current?.getBoundingClientRect();
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
    if (!assetPickerOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (pickerRef.current?.contains(target) || pickerPanelRef.current?.contains(target)) {
        return;
      }
      setAssetPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [assetPickerOpen]);

  useLayoutEffect(() => {
    if (!assetPickerOpen) return;

    updateDropdownPosition();

    const syncPosition = () => updateDropdownPosition();
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [assetPickerOpen, updateDropdownPosition]);

  // Build the current capture signal snapshot
  const buildSignals = useCallback(
    (cancelled: boolean): CaptureSignal => {
      const now = Date.now();
      const hover = cumulativeHoverMs.current +
        (buttonHoverStart.current ? now - buttonHoverStart.current : 0);
      return {
        assetViewedMs: now - assetViewedAt.current,
        stakeEntered: stakeWasModified.current,
        directionSelected: directionWasSelected.current,
        buttonHoverMs: hover,
        buttonProximityPx: closestProximityPx.current === Infinity ? 999 : closestProximityPx.current,
        timeOnFormMs: now - formOpenedAt.current,
        cancelled,
      };
    },
    []
  );

  const attemptPhantomCapture = useCallback(
    (cancelled: boolean) => {
      if (tradePlacedRef.current || activePosition) return;

      const signals = buildSignals(cancelled);
      const prevAsset = prevAssetRef.current;
      const prevDisplayName =
        availableSymbols.find((s) => s.symbol === prevAsset)?.display_name ?? prevAsset;

      evaluateAndCapture({
        signals,
        asset: prevAsset,
        assetDisplayName: prevDisplayName,
        direction: selectedDirection,
        stake: selectedStake > 0 ? selectedStake : DEFAULT_STAKE,
        duration: selectedDuration,
        durationUnit: selectedDurationUnit,
        type: "abandoned",
      });
    },
    [activePosition, buildSignals, selectedDirection, selectedStake, selectedDuration, selectedDurationUnit, availableSymbols]
  );

  const resetSignals = useCallback(() => {
    const now = Date.now();
    formOpenedAt.current = now;
    assetViewedAt.current = now;
    directionWasSelected.current = false;
    stakeWasModified.current = false;
    cumulativeHoverMs.current = 0;
    closestProximityPx.current = Infinity;
    buttonHoverStart.current = null;
    tradePlacedRef.current = false;
    maxStakeRef.current = selectedStake;
    prevDirectionRef.current = selectedDirection;
  }, [selectedStake, selectedDirection]);

  // Reset inactivity timer on user interaction
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    if (directionWasSelected.current || stakeWasModified.current) {
      inactivityTimer.current = setTimeout(() => {
        attemptPhantomCapture(true);
        resetSignals();
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [attemptPhantomCapture, resetSignals]);

  // Track asset changes — capture phantom for the previous asset
  useEffect(() => {
    if (prevAssetRef.current !== selectedAsset) {
      attemptPhantomCapture(true);
      resetSignals();
      prevAssetRef.current = selectedAsset;
    }
  }, [selectedAsset, attemptPhantomCapture, resetSignals]);

  // Capture phantom on unmount (navigation away)
  useEffect(() => {
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      attemptPhantomCapture(true);
    };
    // Intentionally run cleanup only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDirectionSelect = (dir: "CALL" | "PUT") => {
    // If user already selected a direction and is flipping, capture phantom for the abandoned direction
    if (directionWasSelected.current && prevDirectionRef.current !== dir && !activePosition) {
      const prevDir = prevDirectionRef.current;
      const prevDisplayName =
        availableSymbols.find((s) => s.symbol === selectedAsset)?.display_name ?? selectedAsset;
      evaluateAndCapture({
        signals: buildSignals(true),
        asset: selectedAsset,
        assetDisplayName: prevDisplayName,
        direction: prevDir,
        stake: selectedStake > 0 ? selectedStake : DEFAULT_STAKE,
        duration: selectedDuration,
        durationUnit: selectedDurationUnit,
        type: "abandoned",
      });
    }
    prevDirectionRef.current = dir;
    setSelectedDirection(dir);
    directionWasSelected.current = true;
    resetInactivityTimer();
  };

  const handleStakeChange = (value: number) => {
    // If user reduces stake by more than 30% from their peak, capture phantom at peak stake
    if (
      value > 0 &&
      maxStakeRef.current > 0 &&
      value < maxStakeRef.current * 0.7 &&
      stakeWasModified.current &&
      directionWasSelected.current &&
      !activePosition
    ) {
      const prevDisplayName =
        availableSymbols.find((s) => s.symbol === selectedAsset)?.display_name ?? selectedAsset;
      evaluateAndCapture({
        signals: buildSignals(false),
        asset: selectedAsset,
        assetDisplayName: prevDisplayName,
        direction: selectedDirection,
        stake: maxStakeRef.current,
        duration: selectedDuration,
        durationUnit: selectedDurationUnit,
        type: "abandoned",
      });
      maxStakeRef.current = value;
    }
    if (value > maxStakeRef.current) {
      maxStakeRef.current = value;
    }
    setSelectedStake(value);
    stakeWasModified.current = true;
    resetInactivityTimer();
  };

  // Buy button hover tracking
  const handleBuyHoverEnter = () => {
    buttonHoverStart.current = Date.now();
  };
  const handleBuyHoverLeave = () => {
    if (buttonHoverStart.current) {
      cumulativeHoverMs.current += Date.now() - buttonHoverStart.current;
      buttonHoverStart.current = null;
    }
  };

  // Mouse proximity tracking for the buy button
  const handleFormMouseMove = (e: React.MouseEvent) => {
    if (!buyButtonRef.current) return;
    const rect = buyButtonRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.sqrt((e.clientX - cx) ** 2 + (e.clientY - cy) ** 2);
    if (dist < closestProximityPx.current) {
      closestProximityPx.current = dist;
    }
  };

  const handlePlaceTrade = async () => {
    tradePlacedRef.current = true;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);

    setIsPlacingTrade(true);
    setTradeError(null);
    const result = await placeSimulatedTrade({
      asset: selectedAsset,
      assetDisplayName: displayName,
      direction: selectedDirection,
      stake: selectedStake,
      duration: selectedDuration,
      durationUnit: selectedDurationUnit,
    });
    if (!result.success) {
      setTradeError(result.error ?? "Failed to place trade");
    }
    setIsPlacingTrade(false);
    resetSignals();
  };

  const handleSellEarly = async () => {
    await sellSimulatedTradeEarly();
  };

  useEffect(() => {
    let cancelled = false;

    const loadMarketIntel = async () => {
      setIntelLoading(true);
      setIntelError(null);

      try {
        const [contracts, hours] = await Promise.all([
          fetchContractsForAsset(selectedAsset),
          fetchMarketHours(selectedAsset),
        ]);
        if (cancelled) return;
        setAvailableContracts(contracts);
        setMarketHours(hours);
      } catch {
        if (!cancelled) {
          setAvailableContracts([]);
          setMarketHours(null);
          setIntelError("Market intelligence unavailable");
        }
      } finally {
        if (!cancelled) setIntelLoading(false);
      }
    };

    void loadMarketIntel();

    return () => {
      cancelled = true;
    };
  }, [selectedAsset]);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(async () => {
      if (selectedStake <= 0) {
        setProposalPreview(null);
        return;
      }

      setProposalLoading(true);
      try {
        const preview = await fetchProposalPreview({
          symbol: selectedAsset,
          amount: selectedStake,
          duration: selectedDuration,
          durationUnit: selectedDurationUnit as "s" | "m" | "h" | "d" | "t",
          contractType: selectedDirection as ContractType,
        });
        if (!cancelled) setProposalPreview(preview);
      } catch {
        if (!cancelled) setProposalPreview(null);
      } finally {
        if (!cancelled) setProposalLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [selectedAsset, selectedDirection, selectedStake, selectedDuration, selectedDurationUnit]);

  const assetDropdown = (
    <AnimatePresence>
      {assetPickerOpen && portalReady && dropdownStyle && (
        <motion.div
          ref={pickerPanelRef}
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="fixed z-[9999] rounded-xl shadow-2xl max-h-72 flex flex-col overflow-hidden border border-[var(--color-border-hover)]"
          style={{
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            width: dropdownStyle.width,
            background: "var(--color-bg-elevated)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div className="p-2 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                autoFocus
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
                placeholder="Search symbols..."
                className="w-full h-8 pl-7 pr-3 rounded-lg bg-white/5 border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-phantom)]/50 transition-colors"
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            {availableSymbols.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
                Connecting to Deriv to load symbols...
              </div>
            ) : groupedSymbols.size === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
                No symbols match &ldquo;{assetSearch}&rdquo;
              </div>
            ) : (
              Array.from(groupedSymbols.entries()).map(([market, syms]) => (
                <div key={market}>
                  <div
                    className="px-3 py-1.5 text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest sticky top-0"
                    style={{ background: "var(--color-bg-tertiary)" }}
                  >
                    {market}
                  </div>
                  {syms.map((sym) => (
                    <button
                      key={sym.symbol}
                      type="button"
                      onClick={() => {
                        setSelectedAsset(sym.symbol);
                        setAssetPickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/5 transition-colors ${
                        sym.symbol === selectedAsset ? "bg-[var(--color-phantom-dim)]" : ""
                      }`}
                    >
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">
                        {sym.display_name}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                        {sym.symbol}
                      </span>
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
    <div
      className="glass rounded-2xl p-5 h-full card-hover relative overflow-hidden"
      style={{
        borderColor: showTiltWarning ? `${tiltColor}30` : undefined,
        boxShadow: showTiltWarning
          ? `0 0 20px ${tiltColor}10, inset 0 0 20px ${tiltColor}05`
          : undefined,
        transition: "border-color 3s ease, box-shadow 3s ease",
      }}
    >
      {/* Tilt glow border animation */}
      {showTiltWarning && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: `1px solid ${tiltColor}`,
            opacity: 0.2,
            animation: "tilt-pulse 2s ease-in-out infinite",
          }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            Trade Ticket
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--color-phantom-dim)] text-[var(--color-phantom)] border border-[var(--color-phantom)]/20 tracking-wider">
            SIM
          </span>
        </div>
        {activePosition && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-warning-dim)] text-[var(--color-warning)] border border-[var(--color-warning)]/20">
            ACTIVE
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {activePosition ? (
          <motion.div
            key="active"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Active trade display */}
            <div className="p-4 rounded-xl bg-[var(--color-success-dim)] border border-[var(--color-success)]/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {activePosition.asset}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    activePosition.direction === "CALL"
                      ? "bg-[var(--color-success-dim)] text-[var(--color-success)]"
                      : "bg-[var(--color-danger-dim)] text-[var(--color-danger)]"
                  }`}
                >
                  {activePosition.direction === "CALL" ? "RISE" : "FALL"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-[var(--color-text-muted)]">Entry Spot</div>
                  <div className="text-base font-bold text-[var(--color-text-primary)] tabular-nums">
                    {activePosition.entrySpot.toFixed(5)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[var(--color-text-muted)]">Current P&L</div>
                  <div
                    className={`text-xl font-bold tabular-nums ${
                      activePosition.currentPnl >= 0
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-danger)]"
                    }`}
                  >
                    {formatCurrency(activePosition.currentPnl)}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress to expiry */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                <span>Time remaining</span>
                <span>Running...</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[var(--color-success)]"
                  animate={{ width: ["0%", "100%"] }}
                  transition={{ duration: selectedDuration * 60, ease: "linear" }}
                />
              </div>
            </div>

            {/* Sell early */}
            <button
              onClick={handleSellEarly}
              className="w-full h-10 rounded-xl border border-[var(--color-warning)]/30 text-[var(--color-warning)] text-xs font-semibold hover:bg-[var(--color-warning-dim)] transition-all flex items-center justify-center gap-2"
            >
              <XCircle size={14} />
              Sell Early
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
            onMouseMove={handleFormMouseMove}
          >
            {/* Asset selector */}
            <div className="relative" ref={pickerRef}>
              <button
                type="button"
                onClick={() => { setAssetPickerOpen(!assetPickerOpen); setAssetSearch(""); }}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/4 border border-[var(--color-border)] hover:border-[var(--color-border-hover)] transition-colors"
              >
                <div className="text-left">
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-0.5">
                    Asset
                  </div>
                  <div className="text-sm font-bold text-[var(--color-text-primary)]">
                    {displayName}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{selectedAsset}</span>
                  <ChevronDown
                    size={14}
                    className={`text-[var(--color-text-muted)] transition-transform ${assetPickerOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>

            </div>

            {/* Direction */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleDirectionSelect("CALL")}
                className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all border ${
                  selectedDirection === "CALL"
                    ? "bg-[var(--color-success-dim)] border-[var(--color-success)]/40 text-[var(--color-success)]"
                    : "bg-white/4 border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                <TrendingUp size={16} />
                RISE
              </button>
              <button
                onClick={() => handleDirectionSelect("PUT")}
                className={`flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-semibold transition-all border ${
                  selectedDirection === "PUT"
                    ? "bg-[var(--color-danger-dim)] border-[var(--color-danger)]/40 text-[var(--color-danger)]"
                    : "bg-white/4 border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                <TrendingDown size={16} />
                FALL
              </button>
            </div>

            {/* Stake */}
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 block">
                Stake (USD)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={selectedStake}
                  onChange={(e) => handleStakeChange(Number(e.target.value))}
                  min="1"
                  max="1000"
                  className="flex-1 h-10 px-3 rounded-xl bg-white/5 border border-[var(--color-border)] focus:border-[var(--color-phantom)]/50 focus:outline-none text-sm text-[var(--color-text-primary)] tabular-nums transition-colors"
                />
                {[5, 10, 25, 50].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleStakeChange(preset)}
                    className={`px-2.5 h-10 rounded-xl text-xs font-semibold transition-all border ${
                      selectedStake === preset
                        ? "border-[var(--color-phantom)]/40 text-[var(--color-phantom)] bg-[var(--color-phantom-dim)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    }`}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wide mb-1.5 block">
                Duration
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setSelectedDuration(preset.value);
                    }}
                    className={`h-8 rounded-lg text-xs font-semibold transition-all border ${
                      selectedDuration === preset.value && selectedDurationUnit === preset.unit
                        ? "border-[var(--color-real)]/40 text-[var(--color-real)] bg-[var(--color-real-dim)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                  Deriv Market Intelligence
                </p>
                {intelLoading && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">Loading...</span>
                )}
              </div>
              {intelError && <p className="text-[10px] text-[var(--color-danger)]">{intelError}</p>}
              <p className="text-[11px] text-[var(--color-text-secondary)]">
                Market hours: <span className="text-[var(--color-text-primary)]">{marketHours ?? "n/a"}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {availableContracts.slice(0, 6).map((contract) => (
                  <span
                    key={`${contract.contractType}-${contract.minDuration}-${contract.maxDuration}`}
                    className="px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[10px] text-[var(--color-text-secondary)]"
                  >
                    {contract.contractType}
                  </span>
                ))}
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-black/10 p-2">
                <p className="text-[10px] text-[var(--color-text-muted)] mb-1">Proposal preview</p>
                {proposalLoading ? (
                  <p className="text-[10px] text-[var(--color-text-secondary)]">Fetching quote...</p>
                ) : proposalPreview ? (
                  <div className="text-[11px] space-y-1">
                    <p className="text-[var(--color-text-secondary)]">
                      Stake: <span className="text-[var(--color-text-primary)]">{formatCurrency(proposalPreview.askPrice)}</span>
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Payout: <span className="text-[var(--color-success)]">{formatCurrency(proposalPreview.payout)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-[var(--color-text-secondary)]">
                    Proposal unavailable for current setup.
                  </p>
                )}
              </div>
            </div>

            {/* Buy button — simulation only, no real order placed */}
            <button
              ref={buyButtonRef}
              onClick={handlePlaceTrade}
              onMouseEnter={handleBuyHoverEnter}
              onMouseLeave={handleBuyHoverLeave}
              disabled={isPlacingTrade || selectedStake <= 0}
              className="w-full h-12 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 text-white disabled:opacity-50"
              style={{
                background: isOnTilt
                  ? `linear-gradient(135deg, ${tiltColor}80, ${tiltColor})`
                  : selectedDirection === "CALL"
                  ? "linear-gradient(135deg, #059669, #10b981)"
                  : "linear-gradient(135deg, #dc2626, #ef4444)",
              }}
            >
              {isPlacingTrade ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  {selectedDirection === "CALL" ? (
                    <TrendingUp size={16} />
                  ) : (
                    <TrendingDown size={16} />
                  )}
                  Simulate Trade · {formatCurrency(selectedStake)}
                </>
              )}
            </button>

            {tradeError && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-[10px] text-center text-[var(--color-danger)]"
              >
                {tradeError}
              </motion.p>
            )}

            {showTiltWarning && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-[10px] text-center"
                style={{ color: tiltColor }}
              >
                ⚠ Tilt {tiltScore}/100 detected — your win rate drops {tiltScore > 60 ? "40%" : "20%"} at
                this level
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {portalReady ? createPortal(assetDropdown, document.body) : null}
    </div>
  );
}
