'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ExternalLink, X, TrendingUp, Sparkles, Zap } from 'lucide-react';
import GradientText from '@/components/reactbits/GradientText';
import { useArenaAuth } from '@/store/arenaAuthStore';
import { arenaApi } from '@/lib/arena-api';
import type { NudgeTier } from '@/lib/conversion-thresholds';

interface ConversionNudgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  percentile: number;
  message: string;
  tier: NudgeTier;
  autoDismissMs: number | null;
  instanceId: string;
  templateId: string;
  isEndGame?: boolean;
}

export default function ConversionNudgeModal({
  isOpen,
  onClose,
  percentile,
  message,
  tier,
  autoDismissMs,
  instanceId,
  templateId,
  isEndGame = false,
}: ConversionNudgeModalProps) {
  const { user } = useArenaAuth();
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen && autoDismissMs) {
      dismissTimer.current = setTimeout(onClose, autoDismissMs);
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [isOpen, autoDismissMs, onClose]);

  const handleTradeForReal = useCallback(() => {
    const isDemoUser = !user || user.deriv_account_id?.startsWith('DEMO_');
    const eventType = isDemoUser ? 'signup_click' : 'redirect';

    arenaApi.conversion.track({
      event_type: eventType,
      instance_id: instanceId,
      template_id: templateId,
      percentile,
      metadata: { tier, is_end_game: isEndGame },
    }).catch(() => {});

    if (!user || isDemoUser) {
      window.location.href = '/api/auth/deriv';
    } else {
      window.open('https://app.deriv.com', '_blank', 'noopener,noreferrer');
      onClose();
    }
  }, [user, instanceId, templateId, percentile, tier, isEndGame, onClose]);

  const isBanner = tier === 'subtle' || tier === 'moderate';
  const isCelebration = tier === 'celebration';

  if (isBanner) {
    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-xl px-4"
          >
            <div className={`
              rounded-xl border p-4 shadow-xl backdrop-blur-md flex items-center gap-3
              ${tier === 'subtle'
                ? 'bg-emerald-950/80 border-emerald-500/30'
                : 'bg-amber-950/80 border-amber-500/30'
              }
            `}>
              <div className={`
                w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                ${tier === 'subtle' ? 'bg-emerald-500/20' : 'bg-amber-500/20'}
              `}>
                <TrendingUp className={`w-5 h-5 ${tier === 'subtle' ? 'text-emerald-400' : 'text-amber-400'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-white/90 font-medium">{message}</p>
              </div>

              <button
                onClick={handleTradeForReal}
                className={`
                  flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors
                  ${tier === 'subtle'
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  }
                `}
              >
                Trade Real
              </button>

              <button
                onClick={onClose}
                className="flex-shrink-0 text-white/40 hover:text-white/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {autoDismissMs && (
              <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: autoDismissMs / 1000, ease: 'linear' }}
                className={`h-0.5 origin-left mt-0.5 rounded-full ${
                  tier === 'subtle' ? 'bg-emerald-500/50' : 'bg-amber-500/50'
                }`}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className={`
              relative w-full max-w-md border rounded-card p-6 shadow-2xl
              ${isCelebration
                ? 'bg-gradient-to-br from-amber-950/95 to-yellow-950/95 border-yellow-500/40 shadow-yellow-500/10'
                : 'bg-bg-elevated border-accent-primary/30 shadow-glow-gold'
              }
            `}>
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center">
                <div className={`
                  w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center
                  ${isCelebration
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500'
                    : 'bg-gradient-to-br from-accent-soft to-accent-dark'
                  }
                `}>
                  {isCelebration ? (
                    <Sparkles className="w-10 h-10 text-black" />
                  ) : (
                    <Trophy className="w-10 h-10 text-black" />
                  )}
                </div>

                <h2 className="text-2xl font-display font-bold mb-2">
                  <GradientText
                    colors={isCelebration
                      ? ['#FBBF24', '#F59E0B', '#EAB308', '#FBBF24']
                      : ['#E8B45E', '#F5C978', '#D6A04B', '#E8B45E']
                    }
                    animationSpeed={3}
                    className="font-display font-bold"
                  >
                    {isCelebration ? 'Elite Trader' : 'Outstanding Performance'}
                  </GradientText>
                </h2>

                <p className="text-text-secondary mb-6">
                  {message}
                </p>

                {isCelebration && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -8, 0], rotate: [0, 15, -15, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                      >
                        <Zap className="w-5 h-5 text-yellow-400" />
                      </motion.div>
                    ))}
                  </div>
                )}

                <div className="bg-white/[0.03] border border-border rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-success" />
                    <div className="text-left">
                      <div className="text-sm font-medium text-text-primary">
                        Ready to trade for real?
                      </div>
                      <div className="text-xs text-text-muted">
                        Take your proven strategy to Deriv&apos;s live markets
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="btn-secondary flex-1"
                  >
                    Keep Playing
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleTradeForReal}
                    className={`flex-1 gap-2 inline-flex items-center justify-center font-bold px-4 py-2.5 rounded-lg transition-colors ${
                      isCelebration
                        ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-black hover:from-yellow-400 hover:to-amber-400'
                        : 'btn-primary'
                    }`}
                  >
                    Trade for Real
                    <ExternalLink className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
