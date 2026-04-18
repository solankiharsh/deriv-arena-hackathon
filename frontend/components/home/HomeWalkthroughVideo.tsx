"use client";

import { Youtube } from "lucide-react";

/**
 * Ninety-second DerivArena walkthrough, embedded on the home page under
 * JourneyLoop.
 *
 * YOUTUBE_VIDEO_ID is deliberately a plain constant (not an env var) so the
 * repo carries the canonical link. Swap this to the real video id once the
 * demo is uploaded. If left `null`, the section renders a restrained
 * "coming soon" placeholder rather than an embed.
 */
/**
 * Either a bare 11-character YouTube video id (e.g. "CT4vM7ilPLY") or any
 * copy-pasted watch URL — youtu.be short link, watch?v=…, /embed/…, /shorts/….
 * `null` renders the placeholder below instead of an iframe.
 */
const YOUTUBE_VIDEO_ID: string | null =
  "https://youtu.be/CT4vM7ilPLY?si=UnftloDDX17PqKRs";

/**
 * Pull the 11-char video id out of whatever the caller pasted. Returns null
 * if we can't find one (so the placeholder still renders cleanly).
 */
function resolveYoutubeId(input: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Bare id — YouTube video ids are 11 chars of [A-Za-z0-9_-].
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;

  // URL forms. We don't throw on malformed URLs so the placeholder still
  // renders if the user pasted something weird.
  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.replace(/^\//, "");
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split("/").filter(Boolean);
      // handles /embed/<id> and /shorts/<id>
      const last = parts[parts.length - 1];
      return last && /^[A-Za-z0-9_-]{11}$/.test(last) ? last : null;
    }
  } catch {
    // Not a URL — fall through.
  }
  return null;
}

export function HomeWalkthroughVideo() {
  const videoId = resolveYoutubeId(YOUTUBE_VIDEO_ID);

  return (
    <div className="mt-10 sm:mt-14 max-w-4xl mx-auto">
      <div className="text-center mb-4">
        <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-text-muted">
          <Youtube className="w-3.5 h-3.5" />
          Ninety seconds · join → deposit
        </span>
      </div>

      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.55)] bg-black/50">
        {videoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
            title="DerivArena walkthrough"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <Youtube className="w-10 h-10 text-accent-primary/60" />
            <p className="text-sm font-mono uppercase tracking-[0.25em] text-text-muted">
              Walkthrough uploading…
            </p>
            <p className="text-xs text-text-muted max-w-md leading-relaxed">
              Drop the YouTube video id into
              {" "}<code className="font-mono text-accent-primary">YOUTUBE_VIDEO_ID</code>{" "}
              in{" "}
              <code className="font-mono text-accent-primary">
                components/home/HomeWalkthroughVideo.tsx
              </code>{" "}
              to replace this placeholder.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
