'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Trophy, Zap, X, ChevronRight } from 'lucide-react';
import { GAME_INSTRUCTIONS, type GameInstructions } from '@/lib/game-instructions';
import { GAME_MODE_LABELS, type GameMode } from '@/lib/arena-types';

interface GameInstructionsOverlayProps {
  gameMode: string;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 10_000;

export default function GameInstructionsOverlay({
  gameMode,
  onDismiss,
}: GameInstructionsOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  const instructions: GameInstructions =
    GAME_INSTRUCTIONS[gameMode as GameMode] ?? GAME_INSTRUCTIONS.classic;
  const modeName = GAME_MODE_LABELS[gameMode as GameMode] ?? 'Classic Arena';

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  }, [onDismiss]);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / AUTO_DISMISS_MS) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        dismiss();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [dismiss]);

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new Event('app-scroll-lock'));

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      window.dispatchEvent(new Event('app-scroll-unlock'));
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
          onClick={dismiss}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="relative my-6 max-w-lg w-full mx-auto bg-card border border-border rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Countdown bar */}
            <div className="h-1 bg-white/5">
              <motion.div
                className="h-full bg-accent-primary/60"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.05, ease: 'linear' }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1]
                text-text-muted hover:text-text-primary transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 max-h-[min(70vh,42rem)] overflow-y-auto overscroll-contain touch-pan-y">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/20
                  flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-accent-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-text-primary">
                    {modeName}
                  </h2>
                  <p className="text-xs text-text-muted">
                    Read the briefing before the action starts
                  </p>
                </div>
              </div>

              {/* Overview */}
              <p className="text-sm text-text-secondary leading-relaxed mb-5">
                {instructions.overview}
              </p>

              {/* How to play */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-display font-bold uppercase tracking-wider text-text-primary">
                    How to Play
                  </h3>
                </div>
                <ol className="space-y-1.5">
                  {instructions.howToPlay.slice(0, 5).map((step, i) => (
                    <li key={i} className="flex gap-2 text-xs text-text-secondary leading-relaxed">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/[0.05] border border-border
                        flex items-center justify-center text-[10px] font-mono text-text-muted mt-0.5">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* How to win */}
              <div className="bg-accent-primary/5 border border-accent-primary/15 rounded-lg px-4 py-3 mb-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Trophy className="w-4 h-4 text-accent-primary" />
                  <h3 className="text-sm font-display font-bold text-accent-primary">
                    How to Win
                  </h3>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {instructions.howToWin}
                </p>
              </div>

              {/* Key buttons — compact preview */}
              <div className="mb-4">
                <h3 className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-2">
                  Key Controls
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {instructions.buttons.slice(0, 5).map((btn) => (
                    <span
                      key={btn.label}
                      className="text-[10px] font-mono px-2 py-1 rounded-md bg-white/[0.04] border border-border text-text-secondary"
                    >
                      {btn.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Dismiss CTA */}
              <button
                onClick={dismiss}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg
                  bg-accent-primary/10 border border-accent-primary/20
                  text-sm font-display font-bold text-accent-primary
                  hover:bg-accent-primary/15 transition-colors"
              >
                Got it, let&apos;s go
                <ChevronRight className="w-4 h-4" />
              </button>

              <p className="text-center text-[10px] text-text-muted mt-2">
                Auto-dismisses in {Math.ceil(progress / 10)}s &middot; Full guide in &ldquo;About This Game&rdquo; below
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
