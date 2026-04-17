'use client';

import { useState } from 'react';
import { X, Copy, Check, MessageCircle, Send } from 'lucide-react';
import { GAME_MODE_LABELS, type GameMode } from '@/lib/arena-types';
import {
  buildDestinationPath,
  buildPartnerTrackingUrl,
  type PartnerTrackingSource,
} from '@/lib/partner-tracking';

interface ShareGameModalProps {
  templateName: string;
  templateSlug: string;
  gameMode: string;
  durationMinutes?: number;
  partnerId: string;
  onClose: () => void;
}

function buildUrl(origin: string, slug: string, partnerId: string, source: PartnerTrackingSource) {
  const destinationPath = buildDestinationPath(`/compete/${slug}`, {
    utm_source: source,
  });

  // Internal redirect: the URL keeps the partner-tracking query params
  // (`a`, `o`, `c`, `link_id`, `custom1`) for look-and-feel but points at
  // our own `${origin}/click` handler so the user stays inside DerivArena
  // instead of bouncing through `partner-tracking.deriv.com`. The global
  // `ReferralCapture` on `/click` parses `custom1` and forwards to the
  // destination path with `ref` + `utm_source` preserved.
  return buildPartnerTrackingUrl({
    affiliateId: partnerId,
    partnerId,
    destinationPath: `${origin}${destinationPath}`,
    source,
    internal: true,
  });
}

function shareMessage(name: string, mode: string, duration: number | undefined, url: string) {
  const modeLabel = GAME_MODE_LABELS[mode as GameMode] || mode;
  const dur = duration ? `${duration}-min ` : '';
  return `Join me on DerivArena! Play "${name}" (${modeLabel}) — test your trading skills in a ${dur}competition. Click here to play: ${url}`;
}

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function ShareGameModal({
  templateName,
  templateSlug,
  gameMode,
  durationMinutes,
  partnerId,
  onClose,
}: ShareGameModalProps) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  // One-time "shared my first link" Miles award. The server enforces
  // idempotency, so even if the user shares via every channel we only
  // grant once.
  const reportShare = () => {
    try {
      fetch('/api/miles/starter/share-link', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_slug: templateSlug }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Swallow — Miles side-effect must never block the actual share action.
    }
  };

  const copyUrl = buildUrl(origin, templateSlug, partnerId, 'copy');
  const waUrl = buildUrl(origin, templateSlug, partnerId, 'whatsapp');
  const tgUrl = buildUrl(origin, templateSlug, partnerId, 'telegram');
  const twUrl = buildUrl(origin, templateSlug, partnerId, 'twitter');

  const waMessage = shareMessage(templateName, gameMode, durationMinutes, waUrl);
  const tgMessage = shareMessage(templateName, gameMode, durationMinutes, tgUrl);

  const modeLabel = GAME_MODE_LABELS[gameMode as GameMode] || gameMode;
  const dur = durationMinutes ? `${durationMinutes}-min ` : '';
  const tweetText = `I'm playing "${templateName}" on @DerivArena — a ${dur}${modeLabel} trading battle. Think you can beat me?`;

  const handleCopy = () => {
    navigator.clipboard.writeText(copyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    reportShare();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-card p-6 w-full max-w-md mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-primary">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-display font-bold text-text-primary mb-1">Share Game</h3>
        <p className="text-xs text-text-muted mb-5">Invite players to &quot;{templateName}&quot;</p>
        <div className="mb-4 rounded-lg border border-accent-primary/20 bg-accent-primary/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-text-muted">Affiliate / Partner ID</p>
          <p className="mt-1 break-all font-mono text-xs text-accent-primary">{partnerId}</p>
        </div>

        <div className="flex items-center gap-2 bg-bg-primary border border-border rounded-lg p-2 mb-5">
          <input
            readOnly
            value={copyUrl}
            className="flex-1 bg-transparent text-xs text-text-secondary outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-accent-primary/10 border border-accent-primary/30 rounded text-xs text-accent-primary hover:bg-accent-primary/20 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(waMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={reportShare}
            className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-card border border-border hover:border-green-500/40 hover:bg-green-500/5 transition-all group"
          >
            <MessageCircle className="w-6 h-6 text-green-500" />
            <span className="text-[11px] text-text-muted group-hover:text-green-400">WhatsApp</span>
          </a>

          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(tgUrl)}&text=${encodeURIComponent(tgMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={reportShare}
            className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-card border border-border hover:border-blue-400/40 hover:bg-blue-400/5 transition-all group"
          >
            <Send className="w-6 h-6 text-blue-400" />
            <span className="text-[11px] text-text-muted group-hover:text-blue-400">Telegram</span>
          </a>

          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(twUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={reportShare}
            className="flex flex-col items-center gap-2 p-3 sm:p-4 rounded-card border border-border hover:border-text-primary/40 hover:bg-text-primary/5 transition-all group"
          >
            <XIcon className="w-6 h-6 text-text-primary" />
            <span className="text-[11px] text-text-muted group-hover:text-text-primary">X / Twitter</span>
          </a>
        </div>
        <p className="mt-4 text-[10px] text-text-muted text-center">
          Share your first game for a one-time{' '}
          <span className="text-accent-primary">+100 Deriv Miles</span>. A
          referral join pays{' '}
          <span className="text-accent-primary">+250</span>.
        </p>
      </div>
    </div>
  );
}
