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
const YOUTUBE_VIDEO_ID: string | null = null;

export function HomeWalkthroughVideo() {
  return (
    <div className="mt-10 sm:mt-14 max-w-4xl mx-auto">
      <div className="text-center mb-4">
        <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.3em] text-text-muted">
          <Youtube className="w-3.5 h-3.5" />
          Ninety seconds · join → deposit
        </span>
      </div>

      <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10 shadow-[0_12px_48px_rgba(0,0,0,0.55)] bg-black/50">
        {YOUTUBE_VIDEO_ID ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?rel=0&modestbranding=1`}
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
