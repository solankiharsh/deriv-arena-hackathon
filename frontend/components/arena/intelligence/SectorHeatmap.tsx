"use client";

import { CardShell } from "./CardShell";
import { TradingViewWidget } from "./TradingViewWidget";

const CONFIG = {
  colorTheme: "dark",
  dateRange: "1D",
  exchange: "US",
  showChart: false,
  locale: "en",
  largeChartUrl: "",
  isTransparent: true,
  showSymbolLogo: true,
  showFloatingTooltip: false,
  width: "100%",
  height: 280,
  plotLineColorGrowing: "rgba(41, 163, 108, 1)",
  plotLineColorFalling: "rgba(236, 73, 90, 1)",
  gridLineColor: "rgba(240, 243, 250, 0)",
  scaleFontColor: "rgba(209, 212, 220, 1)",
  belowLineFillColorGrowing: "rgba(41, 163, 108, 0.12)",
  belowLineFillColorFalling: "rgba(236, 73, 90, 0.12)",
  belowLineFillColorGrowingBottom: "rgba(41, 163, 108, 0)",
  belowLineFillColorFallingBottom: "rgba(236, 73, 90, 0)",
  symbolActiveColor: "rgba(232, 180, 94, 0.2)",
  tabs: [
    {
      title: "Indices",
      symbols: [
        { s: "OANDA:SPX500USD", d: "S&P 500" },
        { s: "OANDA:NAS100USD", d: "Nasdaq 100" },
        { s: "OANDA:US30USD", d: "Dow 30" },
        { s: "OANDA:DE30EUR", d: "DAX" },
        { s: "OANDA:UK100GBP", d: "FTSE 100" },
        { s: "OANDA:JP225USD", d: "Nikkei 225" },
      ],
    },
    {
      title: "Commodities",
      symbols: [
        { s: "TVC:GOLD", d: "Gold" },
        { s: "TVC:SILVER", d: "Silver" },
        { s: "TVC:USOIL", d: "Crude Oil" },
        { s: "TVC:UKOIL", d: "Brent" },
        { s: "TVC:NATURALGAS", d: "Nat Gas" },
      ],
    },
    {
      title: "Crypto",
      symbols: [
        { s: "COINBASE:BTCUSD", d: "BTC/USD" },
        { s: "COINBASE:ETHUSD", d: "ETH/USD" },
        { s: "COINBASE:SOLUSD", d: "SOL/USD" },
        { s: "COINBASE:XRPUSD", d: "XRP/USD" },
      ],
    },
  ],
};

export function SectorHeatmap() {
  return (
    <CardShell title="Sector & Commodities Heatmap" source="TradingView">
      <TradingViewWidget
        src="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
        config={CONFIG}
        height={280}
      />
    </CardShell>
  );
}
