"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ChevronRight, Radio } from "lucide-react";
import {
  derivWS,
  type DerivStreamStatus as DerivStreamStatusPayload,
  type DerivStreamSource,
} from "@/lib/deriv/websocket";

const SOURCE_LABEL: Record<DerivStreamSource, { short: string; long: string }> = {
  "v2-otp": {
    short: "Deriv Live",
    long: "Deriv v2 API (OTP-signed)",
  },
  "v3-legacy": {
    short: "Deriv Fallback",
    long: "Deriv v3 (legacy fallback)",
  },
  disconnected: {
    short: "Deriv Offline",
    long: "Not connected",
  },
};

/**
 * `DerivStreamStatus`
 *
 * Compact, always-visible indicator that answers "is the Deriv stream live,
 * and which API path is it using?". Uses existing Colosseum tokens:
 *   - `bg-card` / `border-border` surface
 *   - `text-success` (live v2), `text-warning` (legacy fallback),
 *     `text-text-muted` (disconnected)
 *   - `font-mono` for the host/endpoint details
 *
 * Hover / tap to expand into a panel that shows the active host and API
 * version — useful for confirming visually that ticks are flowing from Deriv
 * rather than from a mock/replay source.
 */
export function DerivStreamStatus({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<DerivStreamStatusPayload>(() =>
    derivWS.getStatus(),
  );
  const [expanded, setExpanded] = useState(false);
  const [tickCount, setTickCount] = useState(0);

  useEffect(() => {
    const unsub = derivWS.onStatusChange(setStatus);
    return () => {
      unsub();
    };
  }, []);

  // Pulse the "tick" dot each time we receive a message from Deriv. This gives
  // the user a visual heartbeat proving data is actually streaming in.
  useEffect(() => {
    const unsub = derivWS.onMsgType("tick", () => bumpTick());
    const unsub2 = derivWS.onMsgType("ohlc", () => bumpTick());
    return () => {
      unsub();
      unsub2();
    };
    function bumpTick() {
      // Increment remounts the ping span (`key={tickCount}`) so Tailwind
      // `animate-ping` visibly fires again on each tick/ohlc message.
      setTickCount((n) => n + 1);
    }
  }, []);

  const labels = SOURCE_LABEL[status.source];
  const isLive = status.connected && status.source === "v2-otp";
  const isFallback = status.connected && status.source === "v3-legacy";

  const dotColor = isLive
    ? "bg-success"
    : isFallback
      ? "bg-warning"
      : "bg-text-muted";
  const ringColor = isLive
    ? "bg-success/30"
    : isFallback
      ? "bg-warning/30"
      : "bg-transparent";
  const textColor = isLive
    ? "text-success"
    : isFallback
      ? "text-warning"
      : "text-text-muted";

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 ${className}`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <motion.button
        type="button"
        layout
        onClick={() => setExpanded((v) => !v)}
        aria-label={`Deriv stream status: ${labels.long}`}
        className="group flex items-center gap-2 bg-card border border-border hover:border-strong rounded-full pl-2 pr-3 py-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-colors"
      >
        <span className="relative flex items-center justify-center w-2.5 h-2.5">
          {status.connected && (
            <span
              key={tickCount}
              className={`absolute inset-0 rounded-full ${ringColor} animate-ping`}
            />
          )}
          <span className={`relative w-2 h-2 rounded-full ${dotColor}`} />
        </span>
        <span
          className={`text-[11px] font-medium tracking-wide ${textColor} whitespace-nowrap`}
        >
          {labels.short}
        </span>
        <ChevronRight
          className={`w-3 h-3 text-text-muted transition-transform ${
            expanded ? "rotate-90" : "group-hover:translate-x-0.5"
          }`}
        />
      </motion.button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute bottom-full right-0 mb-2 min-w-[260px] bg-card border border-border rounded-xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-md"
          >
            <div className="flex items-center gap-2 mb-3">
              <Radio className={`w-4 h-4 ${textColor}`} />
              <span className="text-sm font-semibold text-text-primary">
                {labels.long}
              </span>
            </div>

            <dl className="space-y-2 text-[11px] font-mono">
              <Row
                label="Status"
                value={
                  <span className={textColor}>
                    {status.connected ? "CONNECTED" : "DISCONNECTED"}
                  </span>
                }
              />
              <Row
                label="Endpoint"
                value={
                  <span className="text-text-secondary truncate max-w-[170px]">
                    {status.host ?? "—"}
                  </span>
                }
              />
              <Row
                label="API"
                value={
                  <span className="text-text-secondary">
                    {status.source === "v2-otp"
                      ? "trading/v1 (new)"
                      : status.source === "v3-legacy"
                        ? "websockets/v3 (legacy)"
                        : "—"}
                  </span>
                }
              />
              <Row
                label="Messages"
                value={
                  <span className="text-text-secondary inline-flex items-center gap-1">
                    <Activity className="w-3 h-3 text-success" />
                    {tickCount.toLocaleString()}
                  </span>
                }
              />
            </dl>

            <p className="mt-3 pt-3 border-t border-border text-[10px] leading-relaxed text-text-muted">
              Ticks flow directly from Deriv&apos;s WebSocket. A pulsing green
              dot means live v2 (OTP-signed). Amber means we fell back to the
              legacy v3 socket.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-text-muted uppercase tracking-wider text-[10px]">
        {label}
      </dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
