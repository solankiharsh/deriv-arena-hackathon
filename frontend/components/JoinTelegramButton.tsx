'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';

const CHANNEL_URL = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL || 'https://t.me/DerivArenaAsk';
const DISMISS_KEY = 'tg-cta-dismissed';

// Allowlisted URL (compile-time). No user input, no open-redirect risk.
function buildHref(): string {
  try {
    const u = new URL(CHANNEL_URL);
    if (u.protocol !== 'https:' || u.hostname !== 't.me') return 'https://t.me/DerivArenaAsk';
    const utm = 'utm_source=app&utm_medium=navbar&utm_campaign=telegram_join';
    u.search = u.search ? `${u.search}&${utm}` : `?${utm}`;
    return u.toString();
  } catch {
    return 'https://t.me/DerivArenaAsk';
  }
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M21.944 4.02a1.5 1.5 0 0 0-1.553-.186L3.64 10.56a1.3 1.3 0 0 0 .085 2.442l3.84 1.224 1.56 4.89a1.1 1.1 0 0 0 1.81.43l2.28-2.16 3.93 2.88a1.3 1.3 0 0 0 2.04-.77l3-13.38a1.5 1.5 0 0 0-.24-1.095zM10.2 15.12l-.54-3.6 8.04-7.02-7.5 10.62z" />
    </svg>
  );
}

type Variant = 'desktop' | 'mobile';

export default function JoinTelegramButton({ variant = 'desktop' }: { variant?: Variant }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const [pulsing, setPulsing] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
      if (!dismissed) setPulsing(true);
    } catch {
      // localStorage may throw in sandboxed contexts; ignore.
    }
  }, []);

  if (pathname && pathname.startsWith('/admin')) return null;

  const onClick = () => {
    setPulsing(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  const href = buildHref();

  if (variant === 'mobile') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        aria-label="Join Deriv Arena on Telegram"
        className="flex items-center gap-3 px-4 py-3 rounded-none font-medium transition-all duration-200 text-accent-primary hover:bg-accent-primary/5"
      >
        <TelegramIcon className="w-5 h-5" />
        <span>Join on Telegram</span>
      </a>
    );
  }

  return (
    <div className="relative">
      {pulsing && !reduceMotion && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0.6, scale: 1 }}
          animate={{ opacity: 0, scale: 1.6 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full border border-accent-primary/60"
        />
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        aria-label="Join Deriv Arena on Telegram"
        title="Get live leaderboards, competitions, and updates"
        className="relative inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium border border-accent-primary/30 text-accent-primary hover:bg-accent-primary/10 hover:border-accent-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60 transition-all whitespace-nowrap"
      >
        <TelegramIcon className="w-4 h-4" />
        <span className="hidden lg:inline">Join on Telegram</span>
      </a>
    </div>
  );
}
