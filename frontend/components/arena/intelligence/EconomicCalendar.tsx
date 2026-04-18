"use client";

import { CardShell } from "./CardShell";
import { TradingViewWidget } from "./TradingViewWidget";

const CONFIG = {
  colorTheme: "dark",
  isTransparent: true,
  width: "100%",
  height: 320,
  locale: "en",
  importanceFilter: "0,1",
  countryFilter: "us,gb,eu,de,jp,cn,in,au",
};

export function EconomicCalendar() {
  return (
    <CardShell title="Economic Calendar" source="TradingView">
      <TradingViewWidget
        src="https://s3.tradingview.com/external-embedding/embed-widget-events.js"
        config={CONFIG}
        height={320}
      />
    </CardShell>
  );
}
