"use client";

import { useEffect, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { getDB, type JournalEntry } from "@/lib/db/schema";

const FALLBACK_NARRATIVE = `Today's session revealed a recurring pattern: you enter composed, but the moment momentum shifts against you, fear replaces strategy. The pivot point came at 14:32 — you'd built a +$87 lead, then gave back $142 in four rapid-fire trades averaging $35.50 each. That sequence wasn't trading; it was chasing.`;
const FALLBACK_QUOTE = "Your highest-confidence hesitations are your best trades.";

export function LatestJournal() {
  const [entry, setEntry] = useState<JournalEntry | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const db = getDB();
        const latest = await db.journalEntries.orderBy("timestamp").reverse().first();
        if (latest) setEntry(latest);
      } catch {
        // DB not ready
      }
    };
    load();
  }, []);

  const narrative = entry?.narrative ?? FALLBACK_NARRATIVE;
  const quote = entry?.aiQuote ?? FALLBACK_QUOTE;
  const tags = entry?.tags ?? [];
  const dateStr = entry
    ? new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div className="glass rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[#60a5fa]" />
          <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
            Latest Journal Entry
          </h2>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#60a5fa]/10 text-[#60a5fa] border border-[#60a5fa]/20">
            {dateStr ?? "AI Generated"}
          </span>
        </div>
        <Link
          href="/journal"
          className="text-[10px] font-semibold text-[#60a5fa] hover:opacity-80 transition-opacity"
        >
          Archive →
        </Link>
      </div>

      <div className="flex-1 relative">
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed line-clamp-4">
          {narrative}
        </p>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--color-bg-secondary)] to-transparent pointer-events-none" />
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-white/5 text-[var(--color-text-muted)] border border-[var(--color-border)]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-start gap-2">
          <Sparkles size={14} className="text-[#60a5fa] mt-0.5 flex-shrink-0" />
          <blockquote className="text-xs text-[var(--color-text-secondary)] italic">
            &ldquo;{quote}&rdquo;
          </blockquote>
        </div>
      </div>
    </div>
  );
}
