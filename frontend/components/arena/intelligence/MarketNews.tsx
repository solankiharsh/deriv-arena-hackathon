"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { CardShell } from "./CardShell";

/**
 * Market intelligence headline stream. Uses the Hacker News Algolia Search
 * API (free, CORS-friendly) restricted to finance/trading keywords so we
 * always have *something* to render without a paywalled Reuters/Bloomberg
 * feed. If a future `/api/intelligence/news` server proxy is added the only
 * change needed is the `URL` constant.
 */
interface Headline {
  id: string;
  title: string;
  url: string | null;
  points: number;
  createdAt: number;
}

const URL =
  "https://hn.algolia.com/api/v1/search?tags=story&query=(forex%20OR%20trading%20OR%20stocks%20OR%20crypto%20OR%20fed%20OR%20treasury)&hitsPerPage=8";

function timeAgo(epochSec: number): string {
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - epochSec));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function MarketNews() {
  const [items, setItems] = useState<Headline[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`hn ${res.status}`);
        const data = (await res.json()) as {
          hits?: {
            objectID: string;
            title?: string | null;
            story_title?: string | null;
            url?: string | null;
            points?: number | null;
            created_at_i: number;
          }[];
        };
        if (cancelled) return;

        const next = (data.hits ?? [])
          .filter((h) => (h.title ?? h.story_title))
          .map((h) => ({
            id: h.objectID,
            title: (h.title ?? h.story_title) as string,
            url: h.url ?? null,
            points: h.points ?? 0,
            createdAt: h.created_at_i,
          }))
          .slice(0, 8);
        setItems(next);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <CardShell title="Market Intelligence" source="HN">
      {items.length === 0 && !error && (
        <p className="text-[11px] text-white/40 font-mono">Loading headlines…</p>
      )}
      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
        {items.map((it) => (
          <a
            key={it.id}
            href={it.url ?? `https://news.ycombinator.com/item?id=${it.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <div className="text-[12px] text-white/80 group-hover:text-white leading-snug">
              {it.title}
              <ExternalLink className="inline-block w-3 h-3 ml-1 text-white/30 group-hover:text-white/60 align-text-bottom" />
            </div>
            <div className="text-[9px] font-mono uppercase tracking-wider text-white/30 mt-0.5">
              {timeAgo(it.createdAt)} · {it.points} pts
            </div>
          </a>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-[10px] text-white/30 font-mono">
          news feed unreachable · retrying
        </p>
      )}
    </CardShell>
  );
}
