'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export interface LevelUpEvent {
  botId: string;
  botName: string;
  oldLevel: number;
  newLevel: number;
  unlockedFeatures: string[];
}

function formatFeatureName(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function LevelUpNotification({
  event,
  onDismiss,
}: {
  event: LevelUpEvent | null;
  onDismiss: () => void;
}) {
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          key={event.botId + event.newLevel}
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', damping: 20 }}
          className="fixed bottom-8 right-8 z-50 p-5 rounded-lg max-w-xs"
          style={{
            background: 'linear-gradient(135deg, rgba(232,180,94,0.18) 0%, rgba(209,154,58,0.12) 100%)',
            border: '2px solid #E8B45E',
            boxShadow: '0 0 40px rgba(232,180,94,0.4)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 text-white/40 hover:text-white text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
          <motion.div
            initial={{ rotate: -180, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.15, type: 'spring' }}
            className="text-4xl mb-2"
          >
            ⚡
          </motion.div>
          <h3 className="text-lg font-black font-mono uppercase tracking-wider" style={{ color: '#E8B45E' }}>
            Level Up
          </h3>
          <p className="text-xs font-mono text-white/80 mb-3 truncate">{event.botName}</p>
          <p className="text-xs font-mono text-white/60 mb-3">
            Level {event.oldLevel} → <span className="text-[#E8B45E] font-bold">Level {event.newLevel}</span>
          </p>
          {event.unlockedFeatures.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono uppercase text-white/50">Unlocked</p>
              {event.unlockedFeatures.map((f) => (
                <div key={f} className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                  <Sparkles className="w-3 h-3" />
                  <span>{formatFeatureName(f)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
