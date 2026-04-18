"use client";

import { useState } from "react";
import { BarChart3, Terminal as TerminalIcon } from "lucide-react";

import { ArenaPulse } from "@/components/arena/intelligence/ArenaPulse";
import { CryptoMarkets } from "@/components/arena/intelligence/CryptoMarkets";
import { DerivLiveMarkets } from "@/components/arena/intelligence/DerivLiveMarkets";
import { EconomicCalendar } from "@/components/arena/intelligence/EconomicCalendar";
import { FearGreed } from "@/components/arena/intelligence/FearGreed";
import { ForexBoard } from "@/components/arena/intelligence/ForexBoard";
import { MarketNews } from "@/components/arena/intelligence/MarketNews";
import { SectorHeatmap } from "@/components/arena/intelligence/SectorHeatmap";
import { TimezoneClocks } from "@/components/arena/intelligence/TimezoneClocks";

/**
 * `IntelligenceTab` is the Arena's pre-match war room. It blends DerivArena
 * signals (live arenas, top performer) with the broader market radar most
 * competitive traders check before taking a position. Two inner views:
 *
 *  - Market Overview: roomy cards, one topic per card, optimised for scan.
 *  - Terminal: dense multi-column layout that mirrors the Syndicate Terminal
 *    reference screenshots; same data, different density.
 */
type IntelSubtab = "overview" | "terminal";

const GOLD = "#E8B45E";

export default function IntelligenceTab() {
  const [subtab, setSubtab] = useState<IntelSubtab>("overview");

  return (
    <div>
      {/* Header row: title + mode toggle, matching the Syndicate Terminal look. */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 flex items-center justify-center rounded border"
            style={{
              background: "rgba(232,180,94,0.08)",
              borderColor: "rgba(232,180,94,0.3)",
            }}
          >
            <BarChart3 className="w-4 h-4" style={{ color: GOLD }} />
          </div>
          <div>
            <h2
              className="text-base font-mono font-bold uppercase tracking-[0.25em]"
              style={{ color: GOLD }}
            >
              Intelligence Hub
            </h2>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40">
              Deriv WS · CoinGecko · Open-ER-API · TradingView · Alternative.me
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {[
            { value: "overview" as const, label: "Market Overview", icon: BarChart3 },
            { value: "terminal" as const, label: "Terminal", icon: TerminalIcon },
          ].map((t) => {
            const Icon = t.icon;
            const active = subtab === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setSubtab(t.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
                style={
                  active
                    ? {
                        color: GOLD,
                        background: "rgba(232,180,94,0.08)",
                        border: "1px solid rgba(232,180,94,0.25)",
                      }
                    : {
                        color: "rgba(255,255,255,0.3)",
                        border: "1px solid rgba(255,255,255,0.07)",
                      }
                }
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {subtab === "overview" ? <MarketOverview /> : <TerminalView />}
    </div>
  );
}

/**
 * Roomy version. Pulse + live markets span the top row; everything else
 * below is a 3-column grid collapsing to 1 on mobile.
 */
function MarketOverview() {
  return (
    <div className="space-y-4">
      <ArenaPulse />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DerivLiveMarkets />
        <CryptoMarkets />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ForexBoard />
        <FearGreed />
        <MarketNews />
      </div>

      <SectorHeatmap />

      <EconomicCalendar />
    </div>
  );
}

/**
 * Dense version. Clocks at the top, then two tight columns packing all
 * market cards together — mirrors the "Terminal" screenshot layout.
 */
function TerminalView() {
  return (
    <div className="space-y-4">
      <TimezoneClocks />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 space-y-3">
          <ArenaPulse />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <DerivLiveMarkets />
            <CryptoMarkets />
          </div>
          <ForexBoard />
          <SectorHeatmap />
        </div>

        <div className="space-y-3">
          <FearGreed />
          <MarketNews />
          <EconomicCalendar />
        </div>
      </div>
    </div>
  );
}
