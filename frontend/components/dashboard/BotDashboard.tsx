'use client';

import { useEffect, useState } from 'react';
import { Plus, Bot as BotIcon } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBotStore } from '@/lib/stores/bot-store';
import { BotCard } from './BotCard';
import { BotCreationWizard } from './BotCreationWizard';
import { BotDetailView } from './BotDetailView';
import { LevelUpNotification, LevelUpEvent } from './LevelUpNotification';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const GOLD = '#E8B45E';

export function BotDashboard() {
  const { agent } = useAuthStore();
  const userId = agent?.id || 'local-dev-user';
  const {
    bots: botsRaw,
    analytics,
    loading,
    error,
    fetchBots,
    createBot,
    startBot,
    stopBot,
    pauseBot,
    resumeBot,
    deleteBot,
    fetchAnalytics,
  } = useBotStore();
  const bots = Array.isArray(botsRaw) ? botsRaw : [];

  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);

  useEffect(() => {
    fetchBots(userId);
  }, [fetchBots, userId]);

  // Fetch analytics for each bot to populate cards
  useEffect(() => {
    bots.forEach((b) => {
      if (!analytics[b.id]) {
        fetchAnalytics(userId, b.id).catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots.length]);

  // Auto-dismiss level-up event
  useEffect(() => {
    if (!levelUpEvent) return;
    const t = setTimeout(() => setLevelUpEvent(null), 6000);
    return () => clearTimeout(t);
  }, [levelUpEvent]);

  const selectedBot = bots.find((b) => b.id === selectedBotId) || null;

  return (
    <div
      className="p-5 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BotIcon className="w-4 h-4" style={{ color: GOLD }} />
            <h2 className="text-sm font-black font-mono text-white tracking-tight uppercase">AI Trading Bots</h2>
          </div>
          <p className="text-[11px] font-mono text-white/40 mt-1">
            Deploy autonomous agents that trade synthetic markets using AI + indicators + news sentiment.
          </p>
        </div>
        <button
          onClick={() => setWizardOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded text-[11px] font-mono uppercase font-bold tracking-wider shrink-0 transition"
          style={{
            background: `linear-gradient(135deg, ${GOLD} 0%, #D09A3A 100%)`,
            color: '#000',
            boxShadow: `0 0 16px ${GOLD}40`,
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          New Bot
        </button>
      </div>

      {error && (
        <div className="mb-3 text-[11px] font-mono text-red-400 px-3 py-2 rounded" style={{ background: 'rgba(255,0,51,0.08)', border: '1px solid rgba(255,0,51,0.25)' }}>
          {error}
        </div>
      )}

      {loading && bots.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 rounded bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      )}

      {!loading && bots.length === 0 && (
        <div
          className="p-8 rounded text-center"
          style={{ background: 'rgba(255,255,255,0.015)', border: '1px dashed rgba(255,255,255,0.08)' }}
        >
          <BotIcon className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: GOLD }} />
          <p className="text-sm font-mono text-white/60 mb-1">No bots deployed yet</p>
          <p className="text-[11px] font-mono text-white/30 mb-4">
            Create your first AI trading agent in under a minute.
          </p>
          <button
            onClick={() => setWizardOpen(true)}
            className="px-4 py-2 rounded text-[11px] font-mono uppercase font-bold tracking-wider transition"
            style={{
              background: `linear-gradient(135deg, ${GOLD} 0%, #D09A3A 100%)`,
              color: '#000',
            }}
          >
            Deploy First Bot
          </button>
        </div>
      )}

      {bots.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {bots.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              analytics={analytics[bot.id]}
              onSelect={() => setSelectedBotId(bot.id)}
              onStart={() => startBot(userId, bot.id).catch(() => {})}
              onStop={() => stopBot(userId, bot.id).catch(() => {})}
              onPause={() => pauseBot(userId, bot.id).catch(() => {})}
              onResume={() => resumeBot(userId, bot.id).catch(() => {})}
              onDelete={() => deleteBot(userId, bot.id).catch(() => {})}
            />
          ))}
        </div>
      )}

      {/* Creation wizard */}
      <Sheet open={wizardOpen} onOpenChange={setWizardOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl flex flex-col h-full max-h-[100dvh] min-h-0 overflow-hidden border-l p-0 gap-0"
          style={{ background: '#07090F', borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <SheetHeader className="sr-only shrink-0 px-6 pt-6">
            <SheetTitle>Deploy new trading bot</SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6 pt-6">
            <BotCreationWizard
              onCancel={() => setWizardOpen(false)}
              onSubmit={async (payload) => {
                const created = await createBot(userId, payload);
                if (created) {
                  setWizardOpen(false);
                  setSelectedBotId(created.id);
                  try {
                    await startBot(userId, created.id);
                  } catch {
                    /* ignore; user can press Start manually */
                  }
                }
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail view */}
      <BotDetailView
        userId={userId}
        bot={selectedBot}
        open={!!selectedBotId}
        onOpenChange={(open) => !open && setSelectedBotId(null)}
        onLevelUp={(evt) => setLevelUpEvent(evt)}
      />

      {/* Level-up notification */}
      <LevelUpNotification event={levelUpEvent} onDismiss={() => setLevelUpEvent(null)} />
    </div>
  );
}
