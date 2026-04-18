"use client";

import { useEffect, useState } from "react";
import { CardShell } from "./CardShell";

/**
 * Crypto Fear & Greed Index from alternative.me (free, no key). Re-labeled
 * "Arena Sentiment" with a Deriv-trader voice — same numeric source as every
 * trading-desk dashboard out there, but framed around our competitive loop.
 */
interface FngPoint {
  value: number;
  classification: string;
  timestamp: string;
}

function labelColor(classification: string): string {
  const s = classification.toLowerCase();
  if (s.includes("extreme fear")) return "text-red-400";
  if (s.includes("fear")) return "text-orange-400";
  if (s.includes("neutral")) return "text-white/70";
  if (s.includes("greed") && !s.includes("extreme")) return "text-green-400";
  if (s.includes("extreme greed")) return "text-green-300";
  return "text-white/70";
}

export function FearGreed() {
  const [point, setPoint] = useState<FngPoint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("https://api.alternative.me/fng/?limit=1", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`alternative.me ${res.status}`);
        const data = (await res.json()) as {
          data?: { value: string; value_classification: string; timestamp: string }[];
        };
        if (cancelled) return;
        const row = data.data?.[0];
        if (row) {
          setPoint({
            value: Number(row.value),
            classification: row.value_classification,
            timestamp: row.timestamp,
          });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }
    load();
    const id = setInterval(load, 15 * 60 * 1000); // refreshes once/day upstream
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const v = point?.value ?? null;
  const pct = v != null ? Math.max(0, Math.min(100, v)) : 0;

  return (
    <CardShell title="Arena Sentiment" source="Fear & Greed">
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <path
              className="text-white/10"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              style={{ color: "#E8B45E" }}
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${pct}, 100`}
              strokeLinecap="round"
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono font-bold text-lg text-white">
              {v != null ? v : "—"}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <div
            className={`text-sm font-semibold uppercase tracking-wider ${
              point ? labelColor(point.classification) : "text-white/40"
            }`}
          >
            {point?.classification ?? "LOADING"}
          </div>
          <p className="text-[11px] text-white/50 mt-1 leading-snug">
            Greed = more traders willing to take risk in the arena. Fear = sit
            out or hedge with lower stakes.
          </p>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-[10px] text-white/30 font-mono">
          sentiment feed unreachable · retrying
        </p>
      )}
    </CardShell>
  );
}
