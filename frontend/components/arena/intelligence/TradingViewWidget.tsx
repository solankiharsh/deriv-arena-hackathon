"use client";

import { useEffect, useRef } from "react";

/**
 * Wrapper for TradingView's embed widgets. They ship as a script tag that
 * hydrates into its container on insert. We wipe the container on unmount to
 * avoid duplicates when the Intelligence tab re-mounts.
 */
interface TradingViewWidgetProps {
  src: string;
  config: Record<string, unknown>;
  height: number;
}

export function TradingViewWidget({ src, config, height }: TradingViewWidgetProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    wrapper.style.height = `${height}px`;
    host.appendChild(wrapper);

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify(config);
    host.appendChild(script);

    return () => {
      host.innerHTML = "";
    };
  }, [src, config, height]);

  return (
    <div
      ref={hostRef}
      className="tradingview-widget-container"
      style={{ height }}
    />
  );
}
