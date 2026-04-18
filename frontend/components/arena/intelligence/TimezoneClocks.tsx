"use client";

import { useEffect, useState } from "react";

/**
 * Six-column timezone clock row that matches the Terminal view's header.
 * Pure client-side — refreshes once per second via a single interval.
 */
const CITIES: { label: string; tz: string }[] = [
  { label: "NY", tz: "America/New_York" },
  { label: "LON", tz: "Europe/London" },
  { label: "DXB", tz: "Asia/Dubai" },
  { label: "MUM", tz: "Asia/Kolkata" },
  { label: "TYO", tz: "Asia/Tokyo" },
  { label: "SYD", tz: "Australia/Sydney" },
];

function formatTime(tz: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: tz,
    }).format(now);
  } catch {
    return "--:--:--";
  }
}

export function TimezoneClocks() {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {CITIES.map((city) => (
        <div
          key={city.tz}
          className="bg-black/30 border border-white/5 rounded px-3 py-2 text-center"
        >
          <div
            className="text-[9px] font-mono uppercase tracking-[0.2em] mb-0.5"
            style={{ color: "#E8B45E" }}
          >
            {city.label}
          </div>
          <div className="font-mono text-sm tabular-nums text-white/85">
            {formatTime(city.tz, now)}
          </div>
        </div>
      ))}
    </div>
  );
}
