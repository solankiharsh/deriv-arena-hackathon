'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, ExternalLink, X, TrendingUp } from 'lucide-react';
import GradientText from '@/components/reactbits/GradientText';

interface Percentile85ModalProps {
  isOpen: boolean;
  onClose: () => void;
  percentile: number;
  partnerId?: string | null;
  templateId?: string | null;
  instanceId?: string | null;
}

export default function Percentile85Modal({
  isOpen,
  onClose,
  percentile,
  partnerId,
  templateId,
  instanceId,
}: Percentile85ModalProps) {
  const handleDerivRedirect = () => {
    const params = new URLSearchParams();
    if (partnerId) params.set('ref', partnerId);
    if (templateId) params.set('campaign', templateId);
    if (instanceId) params.set('instance', instanceId);

    const derivUrl = `https://deriv.com/signup?${params.toString()}`;
    window.open(derivUrl, '_blank', 'noopener,noreferrer');
  };

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
            <div className="relative w-full max-w-md bg-bg-elevated border border-accent-primary/30 rounded-card p-6 shadow-glow-gold">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent-soft to-accent-dark flex items-center justify-center">
                  <Trophy className="w-10 h-10 text-black" />
                </div>

                <h2 className="text-2xl font-display font-bold mb-2">
                  <GradientText
                    colors={['#E8B45E', '#F5C978', '#D6A04B', '#E8B45E']}
                    animationSpeed={3}
                    className="font-display font-bold"
                  >
                    Outstanding Performance
                  </GradientText>
                </h2>

                <p className="text-text-secondary mb-6">
                  You&apos;ve surpassed <span className="text-accent-primary font-bold">{Math.round(percentile)}%</span> of all traders in this game.
                  Your skills are ready for the real markets.
                </p>

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
                    onClick={handleDerivRedirect}
                    className="btn-primary flex-1 gap-2"
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
