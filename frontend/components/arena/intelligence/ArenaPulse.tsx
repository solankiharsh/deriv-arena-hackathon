"use client";

import { useEffect, useState } from "react";
import { arenaApi } from "@/lib/arena-api";
import type { GameInstance, GlobalLeaderboardEntry } from "@/lib/arena-types";
import { CardShell } from "./CardShell";

interface PulseStats {
  liveInstances: number;
  waitingInstances: number;
  totalPlayers: number;
  topPerformer: { name: string; score: number } | null;
}

/**
 * DerivArena-native status card: counts live instances, players, and highlights
 * the current top performer. Polls every 10s. Renders dashes on backend error
 * instead of failing the whole Intelligence tab.
 */
export function ArenaPulse() {
  const [stats, setStats] = useState<PulseStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [live, waiting, leaderboard] = await Promise.allSettled([
          arenaApi.instances.list({ status: "live" }),
          arenaApi.instances.list({ status: "waiting" }),
          arenaApi.leaderboard.global(5),
        ]);

        if (cancelled) return;

        const liveList = live.status === "fulfilled" ? live.value.instances : [];
        const waitingList =
          waiting.status === "fulfilled" ? waiting.value.instances : [];
        const leaders: GlobalLeaderboardEntry[] =
          leaderboard.status === "fulfilled" ? leaderboard.value.entries : [];

        const totalPlayers = liveList.reduce((acc: number, it: GameInstance) => {
          const raw = (it as unknown as { player_count?: number | string })
            .player_count;
          const n = typeof raw === "number" ? raw : Number(raw ?? 0);
          return acc + (Number.isFinite(n) ? n : 0);
        }, 0);

        // Go/Postgres DECIMAL values come back serialized as strings; coerce
        // to number before arithmetic so we don't explode on `.toFixed`.
        const rawScore = (leaders[0] as unknown as { score?: number | string })
          ?.score;
        const coercedScore =
          typeof rawScore === "number"
            ? rawScore
            : typeof rawScore === "string" && rawScore.length > 0
              ? Number(rawScore)
              : 0;
        const top = leaders[0]
          ? {
              name: leaders[0].display_name || "—",
              score: Number.isFinite(coercedScore) ? coercedScore : 0,
            }
          : null;

        setStats({
          liveInstances: liveList.length,
          waitingInstances: waitingList.length,
          totalPlayers,
          topPerformer: top,
        });
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }

    load();
    const id = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const items = [
    { label: "Live Arenas", value: stats?.liveInstances ?? null },
    { label: "Waiting", value: stats?.waitingInstances ?? null },
    { label: "Active Traders", value: stats?.totalPlayers ?? null },
    {
      label: "Top Performer",
      value: stats?.topPerformer
        ? `${stats.topPerformer.name} · ${Number(stats.topPerformer.score).toFixed(0)}`
        : null,
    },
  ];

  return (
    <CardShell title="Arena Pulse" source="Arena API">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40 mb-1">
              {item.label}
            </div>
            <div className="font-mono text-sm text-white/90 tabular-nums truncate">
              {item.value === null ? (
                <span className="text-white/30">—</span>
              ) : (
                item.value
              )}
            </div>
          </div>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-[10px] text-red-400/70 font-mono">
          arena api unreachable · retrying
        </p>
      )}
    </CardShell>
  );
}
